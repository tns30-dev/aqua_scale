-- Notification Service schema (notification)
-- Parity port of alert_log ONLY (the vestigial `alerts` model/table is dead — DDL has no
-- such table; do not port). Cross-service refs (pond/project/users) are plain UUIDs.
-- DIVERGENCES (deliberate, documented):
--   * all timestamps are timestamptz (monolith mixed naive/aware — gotcha #7)
--   * PARTIAL UNIQUE active-alert guard closes the monolith's dedup race (gotcha #4):
--     concurrent consumers cannot create duplicate active alerts
--   * pond_name denormalized (nullable) until Pond Service exists for enrichment

CREATE TABLE alert_log (
    log_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pond_id           UUID,
    project_id        UUID,
    pond_name         VARCHAR(255),
    "timestamp"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    log_type          VARCHAR(50) NOT NULL,
    message           TEXT NOT NULL,
    severity          VARCHAR(50),
    acknowledged      BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by   UUID,
    acknowledged_at   TIMESTAMPTZ,
    resolved          BOOLEAN NOT NULL DEFAULT FALSE,
    parameter         VARCHAR(100),
    reading_timestamp TIMESTAMPTZ,
    resolved_by       UUID,
    resolved_at       TIMESTAMPTZ,
    CONSTRAINT alert_log_type_valid CHECK (log_type IN ('alert','info','warning'))
);

-- PARITY: active-alert list query backing index
CREATE INDEX idx_alert_log_active
    ON alert_log (project_id, acknowledged, resolved, "timestamp")
    WHERE acknowledged = FALSE AND resolved = FALSE;

-- DIVERGENCE (improvement): monolith had a non-unique dedup index + query-then-insert
-- race; this UNIQUE guard makes the (pond, parameter, active) dedup key atomic.
CREATE UNIQUE INDEX ux_alert_log_active_pond_parameter
    ON alert_log (pond_id, parameter)
    WHERE acknowledged = FALSE AND resolved = FALSE;
