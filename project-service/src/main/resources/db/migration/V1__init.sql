-- Project Service schema (project)
-- Parity port of module_project (managed=False tables). Cross-service user references
-- (owner, created_by, updated_by) are plain UUIDs — users live in identity_access.

CREATE TABLE profile_types (
    profile_type_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     VARCHAR(100) NOT NULL UNIQUE,
    code                     VARCHAR(100) UNIQUE,           -- nullable in monolith
    description              TEXT,
    stage_config             JSONB,                          -- list OR {"stages":[...]} (both valid)
    key_parameter_indicators TEXT[],
    key_growth_indicators    TEXT[],
    theme                    JSONB NOT NULL DEFAULT '{"primary":"#888888","gradient":{"from":"#888888","to":"#cccccc"}}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               UUID,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by               UUID
);

CREATE TABLE projects (
    project_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- PARITY: column is project_owner_id (NOT owner_id); plain UUID cross-service ref
    project_owner_id UUID NOT NULL,
    -- PARITY: PROTECT semantics -> RESTRICT
    profile_type_id  UUID NOT NULL REFERENCES profile_types (profile_type_id) ON DELETE RESTRICT,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by       UUID
);

CREATE INDEX ix_projects_owner ON projects (project_owner_id);

CREATE TABLE parameter_types (
    parameter_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_name VARCHAR(100) NOT NULL,
    parameter_code VARCHAR(100) NOT NULL UNIQUE,
    unit           VARCHAR(50),
    data_type      VARCHAR(50) NOT NULL DEFAULT 'float'
);

CREATE TABLE growth_indicators (
    growth_indicator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(100) NOT NULL,
    unit                VARCHAR(20),
    data_type           VARCHAR(50) NOT NULL DEFAULT 'float'
);

CREATE TABLE project_parameter_settings (
    project_parameter_setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    parameter_id     UUID NOT NULL REFERENCES parameter_types (parameter_id) ON DELETE CASCADE,
    min_threshold    DOUBLE PRECISION,                       -- NULL side is skipped in checks
    max_threshold    DOUBLE PRECISION,
    is_key_parameter BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ux_project_parameter UNIQUE (project_id, parameter_id)
);

CREATE INDEX ix_pps_project ON project_parameter_settings (project_id);

CREATE TABLE project_energy_settings (
    project_energy_setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    type                  VARCHAR(30)   NOT NULL DEFAULT 'electricity',
    unit                  VARCHAR(10)   NOT NULL DEFAULT 'kWh',
    tariff_per_unit       NUMERIC(10,4) NOT NULL DEFAULT 0,   -- PARITY: 4dp
    currency              VARCHAR(3)    NOT NULL DEFAULT 'USD',
    high_hourly_threshold NUMERIC(10,3),                      -- PARITY: 3dp
    high_daily_threshold  NUMERIC(10,3),
    manual_entry_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            UUID,                                -- PARITY: plain UUID, not FK
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            UUID,
    CONSTRAINT ux_project_energy_type UNIQUE (project_id, type)
);
