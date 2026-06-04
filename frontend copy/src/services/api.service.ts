import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config/env';
import {
  clearAuth,
  setCurrentProfileType,
  setCurrentProjectId,
} from '../utils/auth';
import type {
  LoginCredentials,
  LoginResponse,
  MeResponse,
  Pond,
  Alert,
  Project,
  ProjectSummary,
  CyclesResponse,
  CycleDetails,
  UserListItem,
  ProfileUpdateRequest,
  FeatureAccess,
  ActionControl,
  UserOnboardRequest,
  UserOnboardResponse,
  UserAccess,
  UpdateUserAccessRequest,
  AdminUpdateUserProfileRequest,
  PondComparisonOptionsResponse,
  PondComparisonResponse,
  Treatment,
  PondTreatment,
} from '../types';
import type { ProfileConfig } from '../types/profile';
import type { EnergyDashboardData, GroupBy } from '../components/energy/types';

// Read a non-HttpOnly cookie by name. Used to grab the `csrftoken` cookie
function readCookie(name: string): string | null {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// URLs the response interceptor must NOT refresh-and-retry:
//   /auth/refresh → would loop on its own 401.
//   /auth/login   → a 401 here means bad credentials; the caller wants it.
const NO_REFRESH_URLS = ['/api/auth/refresh', '/api/auth/login'];

// Internal flag we tack onto an axios config after one refresh attempt so a
// second 401 on the retried request propagates instead of looping.
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Raw snake_case row shape returned by GET /api/profile-types/.
// Lives at module scope so the mapper below can reference it; not exported.
interface ProfileTypeApiRow {
  profile_type_id: string;
  code: string;
  name: string;
  description: string | null;
  stage_config: unknown;
  key_parameter_indicators: string[] | null;
  key_growth_indicators: string[] | null;
  theme: { primary: string; gradient: { from: string; to: string } };
}

function mapProfileTypeDTO(raw: ProfileTypeApiRow): ProfileConfig {
  return {
    profileTypeId: raw.profile_type_id,
    code: raw.code,
    name: raw.name,
    description: raw.description,
    stageConfig: raw.stage_config,
    keyParameterIndicators: raw.key_parameter_indicators ?? [],
    keyGrowthIndicators: raw.key_growth_indicators ?? [],
    theme: raw.theme,
  };
}

class ApiService {
  private api: AxiosInstance;
  // In-flight refresh promise. Concurrent 401s share this so only ONE POST
  // /api/auth/refresh fires per expiry event. Resets when the call settles.
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: config.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      // Send the HttpOnly access/refresh cookies + the csrftoken cookie on
      // every request. Required for cookie-based auth.
      withCredentials: true,
    });

    // Request interceptor — attach X-CSRFToken on unsafe methods. The token
    // mirrors the `csrftoken` cookie set by GET /api/csrf; Django's
    // CsrfViewMiddleware compares the two and 403s on mismatch.
    this.api.interceptors.request.use((cfg) => {
      const method = cfg.method?.toUpperCase();
      if (method && UNSAFE_METHODS.has(method)) {
        const csrf = readCookie('csrftoken');
        if (csrf) {
          cfg.headers['X-CSRFToken'] = csrf;
        }
      }
      return cfg;
    });

    // Response interceptor — on 401 from any normal request, transparently
    // POST /api/auth/refresh (which sets a new access_token cookie) and
    // retry the original request.
    // We deliberately do NOT trigger a full-page reload on 401:
    //   1. A reload remounts SessionProvider, refires boot probes, and
    //      (combined with the boot/login race) can lock the user out of the
    //      login page itself.
    //   2. The session-aware redirect lives in <ProtectedRoute>: as soon as
    //      `useSession().user` becomes null and loading is false, it does
    //      an in-app `<Navigate to="/login" />`. That's the right layer.
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined;
        const url = original?.url ?? '';
        const skipRefresh = NO_REFRESH_URLS.some((u) => url.includes(u));

        if (
          error.response?.status !== 401 ||
          !original ||
          original._retried ||
          skipRefresh
        ) {
          return Promise.reject(error);
        }

        original._retried = true;
        try {
          await this.ensureRefresh();
          return this.api(original);
        } catch {
          // Refresh cookie also expired/invalid — surface the ORIGINAL 401
          // so the caller (and <ProtectedRoute>) react to the right event.
          return Promise.reject(error);
        }
      },
    );
  }

  /** Deduplicating wrapper around POST /api/auth/refresh. All concurrent
   * callers await the same in-flight promise; the slot clears when settled. */
  private ensureRefresh(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.api
        .post('/api/auth/refresh')
        .then(() => undefined)
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  /** Bootstrap the csrftoken cookie. Call once on app boot. Idempotent. */
  async bootstrapCsrf(): Promise<void> {
    await this.api.get('/api/csrf');
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>(
      '/api/auth/login',
      credentials,
    );
    const data = response.data;

    // Tokens are set as HttpOnly cookies by the backend; the frontend never
    // reads or stores them.

    // Pre-select the first project so the dashboard has something to show.
    // These are pure UI state — stay in localStorage.
    if (data.projects.length > 0) {
      setCurrentProjectId(data.projects[0].projectId);
      setCurrentProfileType(data.projects[0].profileType);
    }

    return data;
  }

  async logout(): Promise<void> {
    try {
      // Refresh token rides in on the `refresh_token` cookie; no body needed.
      await this.api.post('/api/auth/logout');
    } finally {
      clearAuth();
    }
  }

  // Ponds
  async getPonds(projectId: string): Promise<{ ponds: Pond[] }> {
    const response = await this.api.get<{ ponds: Pond[] }>('/api/ponds/', {
      params: { projectId },
    });
    return response.data;
  }

  async getHistoricalData(
    pondId: string,
    startDate: string,
    endDate: string,
    parameters?: string[]
  ): Promise<any> {
    const response = await this.api.get(`/api/ponds/${pondId}/historical/`, {
      params: {
        start: startDate,
        end: endDate,
        parameters: parameters?.join(','),
      },
    });
    return response.data;
  }

  // Profile types
  async getProfileTypes(): Promise<ProfileConfig[]> {
    const response = await this.api.get<ProfileTypeApiRow[]>('/api/profile-types/');
    return response.data.map(mapProfileTypeDTO);
  }

  /**
   * Get complete historical chart data package from backend
   * Uses ChartService on backend to get template-driven, chart-ready data
   * 
   * @param pondId - Pond ID to get data for
   * @param projectId - Project ID (determines which charts to show)
   * @param timeRange - Number of days (30, 60, or 90)
   * @returns Complete chart data package
   */
  // async getHistoricalCharts(
  //   pondId: string,
  //   projectId: string,
  //   timeRange: number = 30
  // ): Promise<{
  //   multiParameterTrends: Array<{
  //     day: string;
  //     date: string;
  //     [parameter: string]: number | string | null;
  //   }>;
  //   correlationHeatmap: {
  //     parameters: string[];
  //     parameterLabels: { [key: string]: string };
  //     matrix: number[][];
  //   };
  //   historicalTrends: Array<{
  //     date: string;
  //     [parameter: string]: number | string | null;
  //   }>;
  //   nitrogenCycle?: Array<{
  //     date: string;
  //     [parameter: string]: number | string | null;
  //   }>;
  //   temperatureTrend?: Array<{
  //     date: string;
  //     [parameter: string]: number | string | null;
  //   }>;
  //   dissolvedOxygen?: Array<{
  //     date: string;
  //     [parameter: string]: number | string | null;
  //   }>;
  //   diseaseRisk?: Array<{
  //     date: string;
  //     [parameter: string]: number | string | null;
  //   }>;
  //   waterQualityIndex?: Array<{
  //     date: string;
  //     wqi: number;
  //     [parameter: string]: number | string | null;
  //   }>;
  // }> {
  //   const response = await this.api.get(`/api/ponds/${pondId}/historical/`, {
  //     params: {
  //       format: 'chart',
  //       timeRange,
  //       projectId,
  //     },
  //   });
  //   return response.data;
  // }

    async getHistoricalCharts(
        pondId: string,
        projectId: string,
        startDate: string,
        endDate: string,
        grouping: string = 'auto',
    ): Promise<any> {
        const response = await this.api.get(`/api/projects/${projectId}/charts/`,{
            params: {
                pondId,
                startDate,
                endDate,
                grouping,
            },
        });

        return response.data;
    }

  // Treatments
  async getTreatments(): Promise<Treatment[]> {
    const response = await this.api.get<Treatment[]>('/api/treatments/');
    return response.data;
  }

  async getPondTreatments(pondId: string): Promise<PondTreatment[]> {
    const response = await this.api.get<PondTreatment[]>('/api/pond-treatments/', {
      params: { pond: pondId },
    });
    return response.data;
  }

  async getAlerts(projectId: string): Promise<{ alerts: Alert[] }> {
    const response = await this.api.get<{ alerts: Alert[] }>('/api/alerts/', {
      params: { projectId },
    });
    return response.data;
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.api.post(`/api/alerts/${alertId}/acknowledge/`, {
      acknowledgedBy,
    });
  }

  // Projects
  async getProjectSummary(projectId: string): Promise<ProjectSummary> {
    const response = await this.api.get<ProjectSummary>(
      `/api/projects/${projectId}/summary/`
    );
    return response.data;
  }

  // Cycles / Historical Data
  /**
   * Get all cycles for a project with profile template
   */
  async getProjectCycles(projectId: string, pondId?: string): Promise<CyclesResponse> {
    const response = await this.api.get<CyclesResponse>(`/api/projects/${projectId}/cycles/`, {
      params: pondId ? { pondId } : {}
    });
    return response.data;
  }

  /**
   * Get detailed information for a specific cycle
   */
  async getCycleDetails(cycleId: string): Promise<CycleDetails> {
    const response = await this.api.get<CycleDetails>(`/api/cycles/${cycleId}/details/`);
    return response.data;
  }


  // Pond Comparison
  // Spec: pond_comparision_reference/api_response_shape.md
  /**
   * Dropdown options for Pond A / Pond B: pond list with active treatments,
   * sensor-data window, and display metadata (companyName / gpsLocation).
   */
  async getPondComparisonOptions(projectId: string): Promise<PondComparisonOptionsResponse> {
    const response = await this.api.get<PondComparisonOptionsResponse>(
      `/api/projects/${projectId}/pond-comparison/ponds/`,
    );
    return response.data;
  }

  /**
   * The Apply call. Always returns 4 metrics + 4 charts in fixed order
   * (ammonium, dissolved_oxygen, turbidity, electricity). Missing values
   * come back as 0; no missingParameters array.
   */
  async getPondComparison(args: {
    projectId: string;
    pondAId: string;
    pondBId: string;
    startDate: string;        // YYYY-MM-DD
    endDate: string;          // YYYY-MM-DD
    grouping?: 'auto' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  }): Promise<PondComparisonResponse> {
    const { projectId, ...params } = args;
    const response = await this.api.get<PondComparisonResponse>(
      `/api/projects/${projectId}/pond-comparison/`,
      { params: { grouping: 'auto', ...params } },
    );
    return response.data;
  }

  async getEnergyDashboard(args: {
    projectId: string;
    startDate?: string;       // YYYY-MM-DD
    endDate?: string;         // YYYY-MM-DD
    groupBy?: GroupBy;
  }): Promise<EnergyDashboardData> {
    const { projectId, ...params } = args;
    const response = await this.api.get<EnergyDashboardData>(
      `/api/projects/${projectId}/energy/dashboard/`,
      { params },
    );
    return response.data;
  }


  // =========================================================================
  // User Management API
  // =========================================================================

  // --- Session bootstrap (any authenticated user) ---

  async getMe(): Promise<MeResponse> {
    const response = await this.api.get('/api/auth/me');
    return response.data;
  }

  // --- Profile (any authenticated user) ---

  async getProfile(): Promise<UserListItem> {
    const response = await this.api.get('/api/auth/profile');
    return response.data;
  }

  async updateProfile(data: ProfileUpdateRequest): Promise<UserListItem> {
    const response = await this.api.put('/api/auth/profile', data);
    return response.data;
  }

  // --- Access Definitions (admin) ---

  async getFeatureAccess(): Promise<FeatureAccess[]> {
    const response = await this.api.get('/api/feature-access');
    return response.data;
  }

  async getActionControls(): Promise<ActionControl[]> {
    const response = await this.api.get('/api/action-controls/');
    return response.data;
  }

  // --- Projects (admin) ---

  /**
   * GET /api/projects/all/ — platform_admin only.
   *
   * Returns the full universe of projects so admins can assign any of them
   * when onboarding or managing users. Distinct from /api/projects/ (the
   * regular user listing), which filters to the caller's own user_projects.
   */
  async getAllProjects(): Promise<Project[]> {
    const response = await this.api.get('/api/projects/all/');
    return response.data;
  }

  // --- Users (admin) ---

  async getUsers(): Promise<UserListItem[]> {
    const response = await this.api.get('/api/users/');
    return response.data;
  }

  async onboardUser(data: UserOnboardRequest): Promise<UserOnboardResponse> {
    const response = await this.api.post('/api/users/', data);
    return response.data;
  }

  // --- User Access (admin) ---

  async getUserAccess(userId: string): Promise<UserAccess> {
    const response = await this.api.get(`/api/users/${userId}/access`);
    return response.data;
  }

  async updateUserAccess(userId: string, data: UpdateUserAccessRequest): Promise<UserAccess> {
    // Backend's UpdateUserAccessSerializer.update() returns the full
    // UserAccessReadSerializer shape, so this mirrors `getUserAccess`.
    const response = await this.api.put(`/api/users/${userId}/access`, data);
    return response.data;
  }

  /**
   * PUT /api/users/<id>/profile — admin edits another user's profile (Phase 4).
   * Distinct from `updateProfile` which is the self-update on /api/auth/profile.
   * partial=True on the BE — any subset of firstName/lastName/mobileNumber/role.
   */
  async updateUserProfile(
    userId: string,
    data: AdminUpdateUserProfileRequest,
  ): Promise<UserListItem> {
    const response = await this.api.put(`/api/users/${userId}/profile`, data);
    return response.data;
  }
}

// Export singleton
export const apiService = new ApiService();

