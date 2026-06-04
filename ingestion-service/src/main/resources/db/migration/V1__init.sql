-- Ingestion Service schema (ingestion) — the DEMO/parsed store.
-- Cloud target for raw telemetry is Bigtable (row key: device/pond hash + reverse ts +
-- seq, families raw/sig/meta/reading — main/polyglot_persistence.md); this Postgres
-- store is the spec-sanctioned cost-safe path. Interfaces in code keep the swap clean.

-- PARITY: dedup key is UNIQUE (iot_device_id, seq_no) — ux_sensor_messages_device_seq
CREATE TABLE sensor_messages (
    sensor_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iot_device_id     UUID NOT NULL,            -- cross-service ref (Sensor Service)
    device_code       VARCHAR(64) NOT NULL,
    seq_no            BIGINT NOT NULL,
    payload           JSONB NOT NULL,           -- raw envelope payload (incl. sig)
    received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_sensor_messages_device_seq UNIQUE (iot_device_id, seq_no)
);

-- One row per (message, port): pivoted parameter_code -> value map (monolith's wide
-- sensor_readings row, narrowed to JSONB for the demo store).
CREATE TABLE sensor_readings (
    reading_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_message_id UUID NOT NULL REFERENCES sensor_messages (sensor_message_id) ON DELETE CASCADE,
    project_id        UUID NOT NULL,
    pond_id           UUID NOT NULL,
    project_sensor_id UUID NOT NULL,
    port              VARCHAR(32) NOT NULL,
    measured_at       TIMESTAMPTZ NOT NULL,
    reading_values    JSONB NOT NULL,           -- {parameter_code: value}
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_readings_pond_time ON sensor_readings (pond_id, measured_at DESC);
CREATE INDEX ix_readings_project_time ON sensor_readings (project_id, measured_at DESC);
