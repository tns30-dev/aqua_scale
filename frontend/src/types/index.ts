// Authentication
export interface LoginCredentials {
  email: string;
  password: string;
}

// Theme = profile code as free-text string. Was a closed union literal pre
// Part-2 / Phase 1; widened so adding a profile in Django admin no longer
// needs a TS code change. Kept under this name for back-compat with `Project`
// fields and other types/index.ts consumers; semantically identical to
// `ProfileType` in `./profile.ts`.
export type Theme = string;

/**
 * One entry in a user's Part 3 permission array.
 * `feature_access` is a top-level capability code (e.g. "overview") or the wildcard sentinel "*".
 * `action_controls` carries action codes under that feature, or ["*"] for "all actions",
 * or [] for "feature but no actions".
 *
 * Note: inner keys are snake_case to match the wire (BE does not transform JSONB).
 * See `user_mgmt_reference/part_3/phase_7.md` § Wire-Format Decision.
 */
export interface FeatureActionEntry {
  feature_access: string;
  action_controls: string[];
}

/** Array of permission entries. Admin sentinel: [{feature_access:"*", action_controls:["*"]}]. No access: []. */
export type FeatureActionAssigned = FeatureActionEntry[];

/** The logged-in user's identity bundle (no project list). */
export interface User {
  userId: string;
  username: string;
  role: string;
  featureActionAssigned: FeatureActionAssigned;
}

/** Session bootstrap payload from GET /api/auth/me. The body carries identity
 * (`user`) and the accessible projects list only.
 *
 * Single canonical session envelope: changing either half (identity vs.
 * project access) means swapping one nested object, not touching five
 * sibling fields. */
export interface MeResponse {
  user: User;
  projects: Project[];
}

export interface LoginResponse extends MeResponse {
  token: string;
  refreshToken: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

export interface Project {
  projectId: string;
  name: string;
  profileTypeId: string;
  profileType: Theme;
}

// ---------------------------------------------------------------------------
// Project Service admin/config contracts
// ---------------------------------------------------------------------------

export interface ProjectParameterSetting {
  parameter_code: string;
  parameter_name: string;
  parameter_unit: string;
  min_threshold: number | null;
  max_threshold: number | null;
  is_key_parameter: boolean;
}

export interface PutProjectParameterSetting {
  parameter_code: string;
  min_threshold?: number | null;
  max_threshold?: number | null;
  is_key_parameter?: boolean;
}

// ---------------------------------------------------------------------------
// Sensor Service admin contracts
// ---------------------------------------------------------------------------

export interface SensorType {
  sensor_type_id: string;
  name: string;
  model_number: string | null;
  parameter_ids: string[];
  parameter_count: number;
  manufacturer: string | null;
  description: string | null;
  is_active: boolean;
}

export interface CreateSensorTypeRequest {
  name: string;
  model_number?: string;
  parameter_ids: string[];
  manufacturer?: string;
  description?: string;
}

export interface IoTDevice {
  iot_device_id: string;
  device_code: string;
  device_name: string;
  status: string;
  config: Record<string, unknown> | null;
  is_active: boolean;
  has_device_key: boolean;
}

export interface RegisterIoTDeviceRequest {
  device_code: string;
  device_name: string;
  config?: Record<string, unknown>;
  device_key?: string;
}

export interface UpdateIoTDeviceRequest {
  device_name?: string;
  status?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
  device_key?: string;
}

export interface ProjectSensor {
  project_sensor_id: string;
  project_id: string;
  pond_id: string;
  sensor_type_id: string;
  sensor_type_name: string;
  iot_device_id: string | null;
  device_code: string | null;
  port: string | null;
  serial_number: string;
  status: string;
  installed_at: string | null;
  sensor_location: string | null;
}

export interface CreateProjectSensorRequest {
  pond_id: string;
  sensor_type_id: string;
  device_code?: string;
  port?: string;
  serial_number: string;
  installed_at?: string;
  sensor_location?: string;
}

export interface UpdateProjectSensorRequest {
  device_code?: string;
  port?: string;
  status?: string;
  installed_at?: string;
  sensor_location?: string;
}

// Ponds
// `healthStatus` is the sensor-derived UI signal (recomputed on every reading
// by pondStatusCalculator). `status` is the persistent operational state set
// by admins in Django (mirrors the BE column `ponds.status`). Renamed from
// `status` → `healthStatus` in module_pond Part-2 Phase 1 so the unqualified
// `status` field aligns with the BE naming.
export type PondHealthStatus = 'healthy' | 'warning' | 'critical' | 'no_reading';
export type PondOperationalStatus =
  | 'active'
  | 'draining'
  | 'cleaning'
  | 'maintenance'
  | 'decommissioned';

export interface Pond {
  pond_id: string;
  project_id: string; // Added to support profile filtering
  profile_type?: Theme; // Profile type from Django backend (shrimp/fish/hatchery/treatment)
  name: string;
  // Operational state — mirrors BE column `ponds.status`. Set in Django admin.
  // Optional in Phase 1; will be made required when the api.service mapper
  // is wired in Part-2 Phase 2.
  status?: PondOperationalStatus;
  // Sensor-derived UI signal — recomputed locally on every reading. Optional
  // because freshly-fetched ponds carry no reading yet; PondGrid wraps each
  // pond with healthStatus before handing it to PondCircle.
  healthStatus?: PondHealthStatus;
  lastUpdated: string;
  metadata?: PondMetadata;
  photo_url?: string;
}

// PondMetadata is a freeform JSONB column on the BE; live data shows two
// distinct shapes — shrimp/fish ponds carry biomass/growth fields, while crab
// hatcheries carry larvae/stage fields. Every field is optional and we accept
// arbitrary future keys via an index signature; renderers iterate whichever
// keys are present rather than relying on a fixed shape.
export interface PondMetadata {
  // Shared across all shapes
  company_name?: string;
  gps_location?: string;
  disease_risk?: "low" | "medium" | "high";
  estimated_harvest_date?: string;

  // Shrimp / fish shape
  biomass_kg?: number;
  growth_rate_percent_per_day?: number;

  // Crab hatchery shape
  larvae_count?: number;
  current_stage?: string;
  days_in_stage?: number;
  survival_rate_percent?: number;
  target_species?: string;

  // Forward-compat: unknown future keys
  [key: string]: unknown;
}

// Treatment catalogue — matches BE TreatmentSerializer 1:1 (snake_case).
export interface Treatment {
  treatment_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Per-pond treatment assignment — matches BE PondTreatmentSerializer. The
// `treatment_*` fields are denormalised by the serializer so consumers don't
// have to join client-side. `is_active` is BE-computed (ended_at IS NULL).
export interface PondTreatment {
  pond_treatment_id: string;
  pond: string;
  treatment: string;
  treatment_name: string;
  treatment_code: string;
  treatment_description?: string | null;
  started_at: string;
  ended_at?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Sensor Readings
export interface SensorReading {
  type: "reading";
  timestamp: string;
  parameters: SensorParameters;
  alerts: AlertInfo[];
}

export interface SensorParameters {
  temperature?: number;
  salinity?: number;
  ph?: number;
  water_level?: number;
  dissolved_oxygen?: number;
  turbidity?: number;
  nitrate?: number;
  nitrite?: number;
  ammonia?: number;
  ammonium?: number;
  ph_lab?: number;
  carbonate?: number;
  bicarbonate?: number;
  tan?: number;
  alkalinity?: number;
  calcium?: number;
  magnesium?: number;
  phosphate?: number;
  total_hardness?: number;
  hydrogen_sulfide?: number;
  total_vibrio_count?: number;
  total_bacteria_count?: number;
}

export interface AlertInfo {
  parameter: string;
  severity: "critical" | "warning";
  currentValue: number;
  threshold: number;
  message: string;
}

// Alerts
export interface Alert {
  alertId: string;
  pondId: string;
  pondName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

// Project Summary
export interface ProjectSummary {
  totalPonds: number;
  activeAlerts: number;
  averageQuality: number;
  forecast: "good" | "fair" | "poor";
}

// Historical Data / Cycles Types
export interface Cycle {
  cycleId: string;
  pondId: string;
  pondName: string;
  startDate: string;
  endDate: string | null;
  status: "ongoing" | "completed" | "terminated";
  displayName: string;
}

export interface ProfileTemplate {
  profileType: string;
  stages: Stage[];
  keyIndicators: string[];
  cycleLengthDays: number;
}

export interface Stage {
  name: string;
  startDay: number;
  endDay: number;
}

export interface StageMetrics {
  [parameterType: string]: {
    current: number;
    min: number;
    max: number;
  };
}

export interface DailyHealth {
  dayNumber: number;
  date: string;
  healthStatus: "excellent" | "good" | "fair" | "poor" | "future";
  alertCount: number;
  stageName: string | null;
}

export interface CyclesResponse {
  projectId: string;
  profileTemplate: ProfileTemplate;
  cycles: Cycle[];
}

export interface CycleDetails {
  cycle: Cycle;
  stageMetrics: {
    [stageName: string]: StageMetrics;
  };
  dailyHealth: DailyHealth[];
}

// ──────────────────────────────────────────────────────────────────────────
// Pond Comparison — types match pond_comparision_reference/api_response_shape.md
// ──────────────────────────────────────────────────────────────────────────

export interface PondTreatmentInfo {
  code: string;
  name: string;
  startedAt: string;  // ISO date
}

/** Options endpoint payload. */
export interface PondComparisonPondOption {
  pondId: string;
  name: string;
  companyName: string;
  gpsLocation: string;
  treatments: PondTreatmentInfo[];   // active only (ended_at IS NULL)
  hasSensorData: boolean;
  firstReadingAt: string | null;     // ISO datetime
  lastReadingAt: string | null;
}
export interface PondComparisonOptionsResponse {
  projectId: string;
  ponds: PondComparisonPondOption[];
}

/** Compare endpoint — metric card payload. Always length 4, fixed order. */
export interface PondComparisonMetric {
  parameter: string;             // 'ammonium' | 'dissolved_oxygen' | 'turbidity' | 'electricity'
  label: string;
  unit: string;
  pondAValue: number;            // 0 if missing per Rule 2
  pondBValue: number;
  difference: number;
  percentDifference: number;
  lowerIsBetter: boolean;
}

/** Compare endpoint — chart payload. Always length 4, fixed order, shared X-axis. */
export interface PondComparisonChartPoint {
  label: string;
  seriesA: number;
  seriesB: number;
}
export interface PondComparisonChart {
  parameter: string;
  title: string;
  unit: string;
  variant: 'line' | 'bar';
  data: PondComparisonChartPoint[];
}

/** Compact per-pond summary embedded in the compare response. */
export interface PondComparisonPondSummary {
  pondId: string;
  name: string;
  treatments: PondTreatmentInfo[];
}

export interface PondComparisonResponse {
  projectId: string;
  pondA: PondComparisonPondSummary;
  pondB: PondComparisonPondSummary;
  dateRange: {
    startDate: string;
    endDate: string;
    grouping: 'hourly' | 'daily' | 'weekly' | 'monthly';  // server resolves 'auto'
  };
  metrics: PondComparisonMetric[];
  charts: PondComparisonChart[];
}

/**
 * Types for User Management module (Part 3 — array-of-objects permission shape).
 * Permissions live on `users.role` (free text) + `users.feature_action_assigned`
 * (JSONB array). Project access lives in `user_projects`. No nested roleAssignments.
 */

// ---------------------------------------------------------------------------
// Access Definitions (reference data)
// ---------------------------------------------------------------------------

/** Top-level capability row (renamed from Part 2 ModuleAccess). */
export interface FeatureAccess {
  featureAccessId: string;
  name: string;
  code: string;
  isDefault: boolean;
}

/** Action row, FK to a parent FeatureAccess (renamed from Part 2 FeatureAccess). */
export interface ActionControl {
  actionControlId: string;
  featureAccessId: string;
  name: string;
  code: string;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Users — list
// ---------------------------------------------------------------------------

export interface UserListItem {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mobileNumber: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Profile update (self-service)
// ---------------------------------------------------------------------------

export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  mobileNumber?: string;
}

// ---------------------------------------------------------------------------
// User onboard (admin)
// ---------------------------------------------------------------------------

export interface UserOnboardRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobileNumber?: string;
  role: string;
  /** Optional in Part 3 — omit (or send []) to let the server apply the default-onboarded array. */
  featureActionAssigned?: FeatureActionAssigned;
  projectIds: string[];
}

export interface UserOnboardResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  mobileNumber: string | null;
  role: string;
  featureActionAssigned: FeatureActionAssigned;
  projectIds: string[];
}

// ---------------------------------------------------------------------------
// User access (read + update — Phase 4 split: role moved to /profile)
// ---------------------------------------------------------------------------

export interface UserAccess {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  featureActionAssigned: FeatureActionAssigned;
  projects: Project[];
}

/** Phase 4: role removed — admin uses AdminUpdateUserProfileRequest for role changes. */
export interface UpdateUserAccessRequest {
  featureActionAssigned?: FeatureActionAssigned;
  projectIds?: string[];
}

/** Phase 4 new endpoint: PUT /api/users/<id>/profile (admin-edits-other). */
export interface AdminUpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  mobileNumber?: string;
  role?: string;
}
