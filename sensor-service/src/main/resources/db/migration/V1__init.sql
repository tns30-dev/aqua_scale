-- Sensor Service schema (sensor)
-- Parity port of module_sensor where THE SQL DDL IS AUTHORITATIVE (managed=False):
--   device_code varchar(64) [DB] not 255 [model]; iot_devices.status default 'offline';
--   the binding (device,port) uniqueness is the stricter ANY-status partial index.
-- Cross-service refs (project_id, pond_id) are plain UUIDs — owners live elsewhere.
-- sensor_messages / sensor_readings belong to INGESTION, not here.

CREATE TABLE sensor_types (
    sensor_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255) NOT NULL,
    model_number   VARCHAR(100) UNIQUE,
    -- denormalized ParameterType ids (catalogue owned by Project Service); no junction table
    parameter_ids  UUID[] NOT NULL DEFAULT '{}',
    manufacturer   VARCHAR(120),
    description    TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sensor_types_parameter_ids_not_empty CHECK (cardinality(parameter_ids) > 0)
);

CREATE TABLE iot_devices (
    iot_device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code   VARCHAR(64)  NOT NULL UNIQUE,        -- natural key for resolution
    device_name   VARCHAR(255) NOT NULL,
    status        VARCHAR(50)  NOT NULL DEFAULT 'offline',
    config        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,  -- THE ingestion gate (status is not)
    device_key    TEXT,                                 -- HMAC shared secret (plaintext, parity)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by    UUID,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID,
    CONSTRAINT iot_devices_status_valid CHECK (status IN ('online','offline','maintenance'))
);

CREATE TABLE project_sensors (
    project_sensor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID NOT NULL,                     -- cross-service ref (Project Service)
    pond_id           UUID NOT NULL,                     -- cross-service ref (Pond Service)
    sensor_type_id    UUID NOT NULL REFERENCES sensor_types (sensor_type_id) ON DELETE RESTRICT,
    iot_device_id     UUID REFERENCES iot_devices (iot_device_id) ON DELETE SET NULL,
    port              VARCHAR(32),
    serial            VARCHAR(128),
    serial_number     VARCHAR(255) NOT NULL UNIQUE,
    status            VARCHAR(50) NOT NULL DEFAULT 'active',
    installed_at      DATE,
    sensor_location   TEXT,                              -- "(lng,lat)" — longitude FIRST (parity)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        UUID,
    CONSTRAINT project_sensors_status_valid CHECK (status IN ('active','inactive','maintenance')),
    -- PARITY (DDL CHECK): a device-attached sensor must declare its port
    CONSTRAINT project_sensors_port_required_if_device
        CHECK (iot_device_id IS NULL OR (port IS NOT NULL AND btrim(port) <> ''))
);

-- PARITY: the BINDING constraint — one mapping per (device, port) regardless of status
CREATE UNIQUE INDEX ux_project_sensors_device_port
    ON project_sensors (iot_device_id, port)
    WHERE iot_device_id IS NOT NULL AND port IS NOT NULL;

CREATE INDEX ix_project_sensors_project ON project_sensors (project_id);
CREATE INDEX ix_project_sensors_device ON project_sensors (iot_device_id);
