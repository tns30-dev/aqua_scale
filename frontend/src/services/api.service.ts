import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config/env';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setCurrentProfileType,
  setCurrentProjectId,
  setAuthTokens,
} from '../utils/auth';
import type {
  LoginCredentials,
  LoginResponse,
  MeResponse,
  RefreshResponse,
  Cycle,
  Pond,
  Alert,
  Project,
  ProjectSummary,
  CyclesResponse,
  CycleDetails,
  ProfileTemplate,
  Stage,
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
  ProjectParameterSetting,
  PutProjectParameterSetting,
  SensorType,
  CreateSensorTypeRequest,
  IoTDevice,
  RegisterIoTDeviceRequest,
  UpdateIoTDeviceRequest,
  ProjectSensor,
  CreateProjectSensorRequest,
  UpdateProjectSensorRequest,
} from '../types';
import type { ProfileConfig } from '../types/profile';
import type { EnergyDashboardData, GroupBy } from '../components/energy/types';

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

interface SessionProjectRef {
  projectId: string;
  name?: string | null;
  profileTypeId?: string | null;
  profileType?: string | null;
}

interface MeApiResponse {
  user: MeResponse['user'];
  projects: SessionProjectRef[];
}

interface LoginApiResponse extends MeApiResponse {
  token: string;
  refreshToken: string;
}

interface ProjectDtoApiRow {
  project_id: string;
  name: string;
  profile_type?: ProfileTypeApiRow | null;
}

interface ProjectAdminApiRow {
  projectId: string;
  name: string;
  profileTypeId: string;
  profileType: string;
}

interface UserAccessApiResponse {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  featureActionAssigned: UserAccess['featureActionAssigned'];
  projectIds?: string[];
  projects?: Project[];
}

type HistoricalDataResponse = Record<string, unknown>;
type ChartDataPoint = Record<string, string | number | null>;

export interface HistoricalChartsResponse {
  multiParameterTrends?: ChartDataPoint[];
  correlationHeatmap?: {
    parameters: string[];
    parameterLabels: Record<string, string>;
    matrix: number[][];
  } | null;
  historicalTrends?: ChartDataPoint[];
  nitrogenCycle?: ChartDataPoint[];
  temperatureTrend?: ChartDataPoint[];
  dissolvedOxygen?: ChartDataPoint[];
  diseaseRisk?: ChartDataPoint[];
  waterQualityIndex?: ChartDataPoint[];
}

interface CycleApiRow {
  cycle_id: string;
  pond_id: string;
  pond_name: string;
  start_date: string;
  end_date: string | null;
  status: Cycle['status'];
  current_day: number;
  duration_days: number;
  is_ongoing: boolean;
}

interface CycleListApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CycleApiRow[];
}

type StageConfigValue = unknown;

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

function normalizeStageConfig(stageConfig: StageConfigValue): Stage[] {
  const rawStages =
    Array.isArray(stageConfig)
      ? stageConfig
      : stageConfig &&
          typeof stageConfig === 'object' &&
          Array.isArray((stageConfig as { stages?: unknown }).stages)
        ? (stageConfig as { stages: unknown[] }).stages
        : [];

  return rawStages.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') {
      return [];
    }
    const stage = raw as Record<string, unknown>;
    const name = typeof stage.name === 'string' ? stage.name : '';
    const startDay = typeof stage.startDay === 'number' ? stage.startDay : Number(stage.startDay);
    const endDay = typeof stage.endDay === 'number' ? stage.endDay : Number(stage.endDay);
    if (!name || !Number.isFinite(startDay) || !Number.isFinite(endDay)) {
      return [];
    }
    return [{ name, startDay, endDay }];
  });
}

function profileTemplateFromConfig(profile?: ProfileConfig): ProfileTemplate {
  const stages = normalizeStageConfig(profile?.stageConfig);
  const configuredLength =
    profile?.stageConfig &&
    typeof profile.stageConfig === 'object' &&
    !Array.isArray(profile.stageConfig) &&
    typeof (profile.stageConfig as { cycleLengthDays?: unknown }).cycleLengthDays === 'number'
      ? (profile.stageConfig as { cycleLengthDays: number }).cycleLengthDays
      : 0;
  const inferredLength = stages.reduce((max, stage) => Math.max(max, stage.endDay), 0);

  return {
    profileType: profile?.code ?? '',
    stages,
    keyIndicators: profile?.keyParameterIndicators ?? [],
    cycleLengthDays: configuredLength || inferredLength,
  };
}

function mapCycleDto(raw: CycleApiRow): Cycle {
  const end = raw.end_date ?? null;
  return {
    cycleId: raw.cycle_id,
    pondId: raw.pond_id,
    pondName: raw.pond_name,
    startDate: raw.start_date,
    endDate: end,
    status: raw.status,
    displayName: end ? `${raw.start_date} - ${end}` : `${raw.start_date} - Ongoing`,
  };
}

function normalizeSessionProject(raw: SessionProjectRef): Project {
  return {
    projectId: raw.projectId,
    name: raw.name ?? `Project ${raw.projectId.slice(0, 8)}`,
    profileTypeId: raw.profileTypeId ?? '',
    profileType: raw.profileType ?? '',
  };
}

function mapProjectDto(raw: ProjectDtoApiRow): Project {
  return {
    projectId: raw.project_id,
    name: raw.name,
    profileTypeId: raw.profile_type?.profile_type_id ?? '',
    profileType: raw.profile_type?.code ?? '',
  };
}

function mapProjectAdminItem(raw: ProjectAdminApiRow): Project {
  return {
    projectId: raw.projectId,
    name: raw.name,
    profileTypeId: raw.profileTypeId,
    profileType: raw.profileType,
  };
}

function accessProjectFromId(projectId: string): Project {
  return {
    projectId,
    name: `Project ${projectId.slice(0, 8)}`,
    profileTypeId: '',
    profileType: '',
  };
}

function userFromSession(payload: MeResponse): UserListItem {
  const [firstName = payload.user.username, ...rest] = payload.user.username.split(' ');
  return {
    userId: payload.user.userId,
    email: '',
    firstName,
    lastName: rest.join(' '),
    mobileNumber: null,
    role: payload.user.role,
    createdAt: '',
  };
}

function mapUserAccessResponse(
  userId: string,
  raw: UserAccessApiResponse,
  profile: UserListItem | null = null,
): UserAccess {
  return {
    userId: raw.userId ?? userId,
    email: raw.email ?? profile?.email ?? '',
    firstName: raw.firstName ?? profile?.firstName ?? '',
    lastName: raw.lastName ?? profile?.lastName ?? '',
    role: raw.role ?? profile?.role ?? '',
    featureActionAssigned: raw.featureActionAssigned ?? [],
    projects: raw.projects ?? raw.projectIds?.map(accessProjectFromId) ?? [],
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
    });

    this.api.interceptors.request.use((cfg) => {
      const token = getAccessToken();
      if (token) {
        cfg.headers.Authorization = `Bearer ${token}`;
      }
      return cfg;
    });

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
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return Promise.reject(new Error('No refresh token available'));
      }
      this.refreshPromise = this.api
        .post<RefreshResponse>('/api/auth/refresh', { refreshToken })
        .then((response) => {
          setAuthTokens(response.data.token, response.data.refreshToken);
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  /** Backward-compatible no-op. Java Identity uses bearer auth, not CSRF cookies. */
  async bootstrapCsrf(): Promise<void> {
    return undefined;
  }

  private async enrichSessionProjects(payload: MeApiResponse): Promise<MeResponse> {
    const normalizedProjects = payload.projects.map(normalizeSessionProject);
    const needsProjectDetails = normalizedProjects.some(
      (project) => !project.profileType || !project.profileTypeId,
    );
    if (!needsProjectDetails) {
      return { user: payload.user, projects: normalizedProjects };
    }

    try {
      const projects = await this.getProjects();
      if (projects.length === 0) {
        return { user: payload.user, projects: normalizedProjects };
      }
      const byId = new Map(projects.map((project) => [project.projectId, project]));
      return {
        user: payload.user,
        projects: normalizedProjects.map((project) => byId.get(project.projectId) ?? project),
      };
    } catch {
      return { user: payload.user, projects: normalizedProjects };
    }
  }

  private async normalizeLogin(payload: LoginApiResponse): Promise<LoginResponse> {
    const session = await this.enrichSessionProjects(payload);
    return {
      token: payload.token,
      refreshToken: payload.refreshToken,
      user: session.user,
      projects: session.projects,
    };
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.api.post<LoginApiResponse>(
      '/api/auth/login',
      credentials,
    );
    setAuthTokens(response.data.token, response.data.refreshToken);
    const data = await this.normalizeLogin(response.data);

    // Pre-select the first project so the dashboard has something to show.
    // These are pure UI state — stay in localStorage.
    if (data.projects.length > 0) {
      setCurrentProjectId(data.projects[0].projectId);
      setCurrentProfileType(data.projects[0].profileType);
    }

    return data;
  }

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    try {
      await this.api.post('/api/auth/logout', refreshToken ? { refreshToken } : {});
    } finally {
      clearAuth();
    }
  }

  // Ponds
  async getPonds(projectId: string): Promise<{ ponds: Pond[] }> {
    const response = await this.api.get<{ ponds: Pond[] }>('/api/ponds', {
      params: { projectId },
    });
    return response.data;
  }

  async getHistoricalData(
    pondId: string,
    startDate: string,
    endDate: string,
    parameters?: string[]
  ): Promise<HistoricalDataResponse> {
    const response = await this.api.get<HistoricalDataResponse>(`/api/ponds/${pondId}/historical/`, {
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
    const response = await this.api.get<ProfileTypeApiRow[]>('/api/profile-types');
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
  ): Promise<HistoricalChartsResponse> {
    const response = await this.api.get<HistoricalChartsResponse>(
      `/api/projects/${projectId}/charts/`,
      {
        params: {
          pondId,
          startDate,
          endDate,
          grouping,
        },
      },
    );

    return response.data;
  }

  // Treatments
  async getTreatments(): Promise<Treatment[]> {
    const response = await this.api.get<Treatment[]>('/api/treatments');
    return response.data;
  }

  async getPondTreatments(pondId: string): Promise<PondTreatment[]> {
    const response = await this.api.get<PondTreatment[]>('/api/pond-treatments', {
      params: { pond: pondId },
    });
    return response.data;
  }

  async getAlerts(projectId: string): Promise<{ alerts: Alert[] }> {
    const response = await this.api.get<{ alerts: Alert[] }>('/api/alerts', {
      params: { projectId },
    });
    return response.data;
  }

  async acknowledgeAlert(alertId: string, _acknowledgedBy?: string): Promise<void> {
    await this.api.post(`/api/alerts/${alertId}/acknowledge`);
  }

  async mintRealtimeToken(): Promise<{ token: string }> {
    const response = await this.api.post<{ token: string }>('/ws/token');
    return response.data;
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
    if (!pondId) {
      throw new Error('pondId is required for cycle lookup');
    }

    const [cyclesResponse, projects, profiles] = await Promise.all([
      this.api.get<CycleListApiResponse>('/api/cycles', {
        params: { pond: pondId },
      }),
      this.getProjects().catch(() => []),
      this.getProfileTypes().catch(() => []),
    ]);
    const project = projects.find((item) => item.projectId === projectId);
    const profile = profiles.find((item) => item.code === project?.profileType);

    return {
      projectId,
      profileTemplate: profileTemplateFromConfig(profile),
      cycles: cyclesResponse.data.results.map(mapCycleDto),
    };
  }

  /**
   * Get detailed information for a specific cycle
   */
  async getCycleDetails(cycleId: string): Promise<CycleDetails> {
    const response = await this.api.get<CycleDetails>(`/api/cycles/${cycleId}/details`);
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
      `/api/projects/${projectId}/pond-comparison/ponds`,
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
      `/api/projects/${projectId}/pond-comparison`,
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
    const response = await this.api.get<MeApiResponse>('/api/auth/me');
    return this.enrichSessionProjects(response.data);
  }

  // --- Profile (any authenticated user) ---

  async getProfile(): Promise<UserListItem> {
    return userFromSession(await this.getMe());
  }

  async updateProfile(data: ProfileUpdateRequest): Promise<UserListItem> {
    const response = await this.api.patch<MeApiResponse>('/api/auth/me', data);
    return userFromSession(await this.enrichSessionProjects(response.data));
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
    const response = await this.api.get<ProjectAdminApiRow[]>('/api/projects/all');
    return response.data.map(mapProjectAdminItem);
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.api.get<ProjectDtoApiRow[]>('/api/projects');
    return response.data.map(mapProjectDto);
  }

  // --- Users (admin) ---

  async getUsers(): Promise<UserListItem[]> {
    const response = await this.api.get<UserListItem[]>('/api/users');
    return response.data;
  }

  private async findUserListItem(userId: string): Promise<UserListItem | null> {
    try {
      const users = await this.getUsers();
      return users.find((user) => user.userId === userId) ?? null;
    } catch {
      return null;
    }
  }

  async onboardUser(data: UserOnboardRequest): Promise<UserOnboardResponse> {
    const response = await this.api.post<UserOnboardResponse>('/api/users', data);
    return response.data;
  }

  // --- User Access (admin) ---

  async getUserAccess(userId: string): Promise<UserAccess> {
    const response = await this.api.get<UserAccessApiResponse>(`/api/users/${userId}/access`);
    const profile = await this.findUserListItem(userId);
    return mapUserAccessResponse(userId, response.data, profile);
  }

  async updateUserAccess(userId: string, data: UpdateUserAccessRequest): Promise<UserAccess> {
    const response = await this.api.put<UserAccessApiResponse>(`/api/users/${userId}/access`, data);
    const profile = await this.findUserListItem(userId);
    return mapUserAccessResponse(userId, response.data, profile);
  }

  /**
   * PATCH /api/users/<id> — admin edits another user's profile.
   * Distinct from `updateProfile`, which is self-update on /api/auth/me.
   */
  async updateUserProfile(
    userId: string,
    data: AdminUpdateUserProfileRequest,
  ): Promise<UserListItem> {
    const response = await this.api.patch<UserListItem>(`/api/users/${userId}`, data);
    return response.data;
  }

  // --- Project administration and settings ---

  async createProject(data: {
    name: string;
    description?: string;
    profileTypeId: string;
    ownerUserId?: string;
  }): Promise<Project> {
    const response = await this.api.post<ProjectDtoApiRow>('/api/projects', data);
    return mapProjectDto(response.data);
  }

  async updateProject(
    projectId: string,
    data: { name?: string; description?: string },
  ): Promise<Project> {
    const response = await this.api.patch<ProjectDtoApiRow>(`/api/projects/${projectId}`, data);
    return mapProjectDto(response.data);
  }

  async getProjectParameterSettings(projectId: string): Promise<ProjectParameterSetting[]> {
    const response = await this.api.get<ProjectParameterSetting[]>(
      `/api/projects/${projectId}/parameter-settings`,
    );
    return response.data;
  }

  async updateProjectParameterSettings(
    projectId: string,
    settings: PutProjectParameterSetting[],
  ): Promise<ProjectParameterSetting[]> {
    const response = await this.api.put<ProjectParameterSetting[]>(
      `/api/projects/${projectId}/parameter-settings`,
      settings,
    );
    return response.data;
  }

  // --- Sensor administration ---

  async getSensorTypes(): Promise<SensorType[]> {
    const response = await this.api.get<SensorType[]>('/api/sensor-types');
    return response.data;
  }

  async createSensorType(data: CreateSensorTypeRequest): Promise<SensorType> {
    const response = await this.api.post<SensorType>('/api/sensor-types', data);
    return response.data;
  }

  async getIoTDevices(): Promise<IoTDevice[]> {
    const response = await this.api.get<IoTDevice[]>('/api/iot-devices');
    return response.data;
  }

  async registerIoTDevice(data: RegisterIoTDeviceRequest): Promise<IoTDevice> {
    const response = await this.api.post<IoTDevice>('/api/iot-devices', data);
    return response.data;
  }

  async updateIoTDevice(deviceId: string, data: UpdateIoTDeviceRequest): Promise<IoTDevice> {
    const response = await this.api.patch<IoTDevice>(`/api/iot-devices/${deviceId}`, data);
    return response.data;
  }

  async getProjectSensors(projectId: string): Promise<ProjectSensor[]> {
    const response = await this.api.get<ProjectSensor[]>(`/api/projects/${projectId}/sensors`);
    return response.data;
  }

  async createProjectSensor(
    projectId: string,
    data: CreateProjectSensorRequest,
  ): Promise<ProjectSensor> {
    const response = await this.api.post<ProjectSensor>(`/api/projects/${projectId}/sensors`, data);
    return response.data;
  }

  async updateProjectSensor(
    projectSensorId: string,
    data: UpdateProjectSensorRequest,
  ): Promise<ProjectSensor> {
    const response = await this.api.patch<ProjectSensor>(
      `/api/project-sensors/${projectSensorId}`,
      data,
    );
    return response.data;
  }
}

// Export singleton
export const apiService = new ApiService();
