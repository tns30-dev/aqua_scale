-- Identity & Access Service schema (identity_access)
-- Parity source: AquaMonitoringv2 module_user (managed=False tables), minus dead tables:
--   * legacy `roles` table NOT ported (blocked/unused in monolith)
--   * no last_login column (explicitly removed in monolith User model)

CREATE TABLE users (
    user_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   VARCHAR(255) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    first_name              VARCHAR(255) NOT NULL,
    last_name               VARCHAR(255) NOT NULL,
    mobile_number           VARCHAR(50),
    role                    VARCHAR(50)  NOT NULL DEFAULT 'user',
    feature_action_assigned JSONB        NOT NULL DEFAULT '[]'::jsonb,
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Case-insensitive email uniqueness (monolith: iexact check + lowercased storage)
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));

CREATE TABLE user_projects (
    user_project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    -- project_id is a cross-service reference (Project Service owns projects): no FK.
    project_id      UUID NOT NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by     UUID REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT ux_user_projects UNIQUE (user_id, project_id)
);

CREATE INDEX ix_user_projects_user ON user_projects (user_id);

CREATE TABLE feature_access (
    feature_access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    code              VARCHAR(100) NOT NULL UNIQUE,
    is_default        BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE action_control (
    action_control_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_access_id UUID NOT NULL REFERENCES feature_access (feature_access_id) ON DELETE RESTRICT,
    name              VARCHAR(255) NOT NULL,
    code              VARCHAR(100) NOT NULL UNIQUE,
    is_default        BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX ix_action_control_feature ON action_control (feature_access_id);
