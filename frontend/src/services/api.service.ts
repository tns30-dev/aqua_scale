import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config/env';
import {
  clearAuth,
  getCurrentProfileType,
  getCurrentProjectId,
  setCurrentProfileType,
  setCurrentProjectId,
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
  CreateTreatmentRequest,
  UpdateTreatmentRequest,
  PondTreatment,
  CreatePondTreatmentRequest,
  UpdatePondTreatmentRequest,
  TreatmentStabilityResponse,
  EnergyDashboardData,
  EnergySettings,
  EnergySettingsUpdate,
  GroupBy,
  ProjectParameterSetting,
  ProjectParameterOption,
  PutProjectParameterSetting,
  SensorType,
  CreateSensorTypeRequest,
  IoTDevice,
  RegisterIoTDeviceRequest,
  UpdateIoTDeviceRequest,
  ProjectSensor,
  CreateProjectSensorRequest,
  UpdateProjectSensorRequest,
  SensorReading,
  SensorParameters,
  AlertInfo,
} from '../types';
import type { ProfileConfig } from '../types/profile';
import type {
  FeedEntryWrite,
  FeedingDashboardResponse,
  FeedingOptionsResponse,
  FeedTypeRecord,
} from '../types/feeding';

// URLs the response interceptor must NOT refresh-and-retry:
//   /auth/refresh → would loop on its own 401.
//   /auth/login   → a 401 here means bad credentials; the caller wants it.
const NO_REFRESH_URLS = ['/api/csrf', '/api/auth/refresh', '/api/auth/login'];
const CSRF_COOKIE = 'csrftoken';
const CSRF_HEADER = 'X-CSRFToken';
const SAFE_METHODS = new Set(['get', 'head', 'options', 'trace']);

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

interface CsrfResponse {
  ok: boolean;
  csrfToken?: string;
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
  mobileNumber?: string | null;
  role: string;
  featureActionAssigned: UserAccess['featureActionAssigned'];
  projectIds?: string[];
  projects?: Project[];
}

type HistoricalDataResponse = Record<string, unknown>;
type ChartDataPoint = Record<string, string | number | null>;

interface LatestReadingApiRow {
  pond_id: string;
  timestamp: string;
  parameters?: Record<string, unknown>;
  alerts?: AlertInfo[];
}

interface LatestReadingsApiResponse {
  readings: LatestReadingApiRow[];
}

export interface LatestPondReading {
  pond_id: string;
  reading: SensorReading;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }
  const prefix = `${name}=`;
  const item = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!item) {
    return null;
  }
  try {
    return decodeURIComponent(item.slice(prefix.length));
  } catch {
    return null;
  }
}

function isUnsafeMethod(method?: string): boolean {
  return !SAFE_METHODS.has((method ?? 'get').toLowerCase());
}

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

function normalizeSensorParameters(raw: Record<string, unknown> = {}): SensorParameters {
  const parameters: SensorParameters = {};
  for (const [key, value] of Object.entries(raw)) {
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;
    if (Number.isFinite(numericValue)) {
      (parameters as Record<string, number>)[key] = numericValue;
    }
  }
  return parameters;
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
    mobileNumber: raw.mobileNumber ?? profile?.mobileNumber ?? null,
    role: raw.role ?? profile?.role ?? '',
    featureActionAssigned: raw.featureActionAssigned ?? [],
    projects: raw.projects ?? raw.projectIds?.map(accessProjectFromId) ?? [],
  };
}

class ApiService {
  private api: AxiosInstance;
  private csrfToken: string | null = null;
  // In-flight refresh promise. Concurrent 401s share this so only ONE POST
  // /api/auth/refresh fires per expiry event. Resets when the call settles.
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: config.apiBaseUrl,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use(async (cfg) => {
      if (isUnsafeMethod(cfg.method)) {
        if (!readCookie(CSRF_COOKIE)) {
          await this.bootstrapCsrf();
        }
        const csrfToken = readCookie(CSRF_COOKIE) ?? this.csrfToken;
        if (csrfToken) {
          cfg.headers[CSRF_HEADER] = csrfToken;
        }
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
      this.refreshPromise = (async () => {
        if (!readCookie(CSRF_COOKIE)) {
          await this.bootstrapCsrf();
        }
        await this.api.post<RefreshResponse>('/api/auth/refresh');
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  async bootstrapCsrf(): Promise<void> {
    const response = await this.api.get<CsrfResponse>('/api/csrf');
    if (typeof response.data.csrfToken === 'string' && response.data.csrfToken) {
      this.csrfToken = response.data.csrfToken;
    }
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
    await this.bootstrapCsrf();
    const response = await this.api.post<LoginApiResponse>(
      '/api/auth/login',
      credentials,
    );
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
    try {
      if (!readCookie(CSRF_COOKIE)) {
        await this.bootstrapCsrf();
      }
      await this.api.post('/api/auth/logout');
    } finally {
      this.csrfToken = null;
      clearAuth();
    }
  }

  // Ponds
  async getPonds(projectId: string): Promise<{ ponds: Pond[] }> {
    const response = await this.api.get<{ ponds: Pond[] }>('/api/ponds', {
      params: { projectId },
    });

    let profileType =
      getCurrentProjectId() === projectId ? getCurrentProfileType() ?? '' : '';
    if (!profileType) {
      try {
        profileType =
          (await this.getProjects()).find((project) => project.projectId === projectId)
            ?.profileType ?? '';
      } catch {
        profileType = '';
      }
    }

    return {
      ...response.data,
      ponds: response.data.ponds.map((pond) => ({
        ...pond,
        project_id: pond.project_id ?? projectId,
        profile_type: pond.profile_type ?? profileType,
      })),
    };
  }

  async getLatestPondReadings(
    projectId: string,
    pondIds: string[] = [],
  ): Promise<{ readings: LatestPondReading[] }> {
    const response = await this.api.get<LatestReadingsApiResponse>('/api/ponds/latest-readings', {
      params: {
        projectId,
        ponds: pondIds.length > 0 ? pondIds.join(',') : undefined,
      },
    });

    return {
      readings: response.data.readings.flatMap((row) => {
        if (!row.pond_id || !row.timestamp) {
          return [];
        }
        const parameters = normalizeSensorParameters(row.parameters);
        return [{
          pond_id: row.pond_id,
          reading: {
            type: 'reading',
            timestamp: row.timestamp,
            parameters,
            alerts: row.alerts ?? [],
          },
        }];
      }),
    };
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
  async getTreatments(projectId?: string): Promise<Treatment[]> {
    const response = await this.api.get<Treatment[]>('/api/treatments/', {
      params: projectId ? { project: projectId } : undefined,
    });
    return response.data;
  }

  async createTreatment(body: CreateTreatmentRequest): Promise<Treatment> {
    const response = await this.api.post<Treatment>('/api/treatments/', body);
    return response.data;
  }

  async updateTreatment(treatmentId: string, body: UpdateTreatmentRequest): Promise<Treatment> {
    const response = await this.api.patch<Treatment>(`/api/treatments/${treatmentId}/`, body);
    return response.data;
  }

  async deleteTreatment(treatmentId: string): Promise<void> {
    await this.api.delete(`/api/treatments/${treatmentId}/`);
  }

  async getPondTreatments(pondId: string): Promise<PondTreatment[]> {
    const response = await this.api.get<PondTreatment[]>('/api/pond-treatments/', {
      params: { pond: pondId },
    });
    return response.data;
  }

  async startPondTreatment(body: CreatePondTreatmentRequest): Promise<PondTreatment> {
    const response = await this.api.post<PondTreatment>('/api/pond-treatments/', body);
    return response.data;
  }

  async updatePondTreatment(
    pondTreatmentId: string,
    body: UpdatePondTreatmentRequest,
  ): Promise<PondTreatment> {
    const response = await this.api.patch<PondTreatment>(
      `/api/pond-treatments/${pondTreatmentId}/`,
      body,
    );
    return response.data;
  }

  async deletePondTreatment(pondTreatmentId: string): Promise<void> {
    await this.api.delete(`/api/pond-treatments/${pondTreatmentId}/`);
  }

  async getTreatmentStability(
    pondId: string,
    courseIds: string[],
  ): Promise<TreatmentStabilityResponse> {
    const response = await this.api.get<TreatmentStabilityResponse>(
      '/api/pond-treatments/stability/',
      {
        params: { pond: pondId, courses: courseIds.join(',') },
      },
    );
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

  /** Apply a comparison. Omit parameters for treatment-derived/default selection. */
  async getPondComparison(args: {
    projectId: string;
    pondAId: string;
    pondBId: string;
    startDate: string;        // YYYY-MM-DD
    endDate: string;          // YYYY-MM-DD
    grouping?: 'auto' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    parameters?: string[];
  }): Promise<PondComparisonResponse> {
    const { projectId, parameters, ...params } = args;
    const requestParams: Record<string, string> = { grouping: 'auto', ...params };
    if (parameters && parameters.length > 0) {
      requestParams.parameters = parameters.join(',');
    }
    const response = await this.api.get<PondComparisonResponse>(
      `/api/projects/${projectId}/pond-comparison`,
      { params: requestParams },
    );
    return response.data;
  }

  async getFeedingOptions(projectId: string): Promise<FeedingOptionsResponse> {
    const response = await this.api.get<FeedingOptionsResponse>(
      `/api/projects/${projectId}/feeding/options/`,
    );
    return response.data;
  }

  async getFeedTypes(projectId: string): Promise<FeedTypeRecord[]> {
    const response = await this.api.get<FeedTypeRecord[]>('/api/feed-types/', {
      params: { project: projectId },
    });
    return response.data;
  }

  async createFeedType(body: {
    project: string;
    name: string;
    pack_kg: string;
    pack_price: string;
  }): Promise<FeedTypeRecord> {
    const response = await this.api.post<FeedTypeRecord>('/api/feed-types/', body);
    return response.data;
  }

  async updateFeedType(
    feedTypeId: string,
    body: Partial<{ name: string; pack_kg: string; pack_price: string; active: boolean }>,
  ): Promise<FeedTypeRecord> {
    const response = await this.api.patch<FeedTypeRecord>(
      `/api/feed-types/${feedTypeId}/`,
      body,
    );
    return response.data;
  }

  async deleteFeedType(feedTypeId: string): Promise<void> {
    await this.api.delete(`/api/feed-types/${feedTypeId}/`);
  }

  async getFeedingDashboard(args: {
    projectId: string;
    cycleId: string;
    compareId?: string | null;
  }): Promise<FeedingDashboardResponse> {
    const { projectId, cycleId, compareId } = args;
    const response = await this.api.get<FeedingDashboardResponse>(
      `/api/projects/${projectId}/feeding/dashboard/`,
      { params: { cycle: cycleId, ...(compareId ? { compare: compareId } : {}) } },
    );
    return response.data;
  }

  async saveFeedDay(args: {
    pondId: string;
    date: string;
    entries: FeedEntryWrite[];
  }): Promise<void> {
    await this.api.put(`/api/ponds/${args.pondId}/feed-days/${args.date}/`, {
      entries: args.entries,
    });
  }

  async saveCycleBiomass(args: {
    cycleId: string;
    stockingBiomassKg?: number | null;
    harvestBiomassKg?: number | null;
  }): Promise<void> {
    const { cycleId, ...body } = args;
    await this.api.patch(`/api/cycles/${cycleId}/biomass/`, body);
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

  async getEnergyAlerts(args: {
    projectId: string;
    all?: boolean;
    startDate?: string;       // YYYY-MM-DD
    endDate?: string;         // YYYY-MM-DD
  }): Promise<{ alerts: Alert[] }> {
    const { projectId, all, ...range } = args;
    const response = await this.api.get<{ alerts: Alert[] }>('/api/alerts', {
      params: {
        projectId,
        parameterPrefix: 'electricity',
        ...(all ? { all: 'true', ...range } : {}),
      },
    });
    return response.data;
  }

  async getEnergySettings(args: { projectId: string; type?: string }): Promise<EnergySettings> {
    const { projectId, ...params } = args;
    const response = await this.api.get<EnergySettings>(
      `/api/projects/${projectId}/energy/settings/`,
      { params },
    );
    return response.data;
  }

  async updateEnergySettings(args: {
    projectId: string;
    type?: string;
    settings: EnergySettingsUpdate;
  }): Promise<EnergySettings> {
    const { projectId, type, settings } = args;
    const response = await this.api.put<EnergySettings>(
      `/api/projects/${projectId}/energy/settings/`,
      settings,
      { params: type ? { type } : undefined },
    );
    return response.data;
  }

  async downloadEnergyExport(args: {
    projectId: string;
    startDate?: string;       // YYYY-MM-DD
    endDate?: string;         // YYYY-MM-DD
  }): Promise<{ blob: Blob; filename: string }> {
    const { projectId, ...params } = args;
    const response = await this.api.get<Blob>(
      `/api/projects/${projectId}/energy/export/`,
      { params, responseType: 'blob' },
    );
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^";]+)"?/);
    return {
      blob: response.data,
      filename: match?.[1] ?? `energy_${params.startDate}_${params.endDate}.xlsx`,
    };
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

  async getProjectParameters(projectId: string): Promise<ProjectParameterOption[]> {
    const response = await this.api.get<ProjectParameterOption[]>(
      `/api/projects/${projectId}/parameters/`,
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
