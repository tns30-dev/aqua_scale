-- Audit Service schema (spec: main/audit_service.md) — APPEND-ONLY by construction.
-- NET-NEW capability: the monolith has no audit table; the platform event stream +
-- dedicated audit.event.recorded topic feed this trail.

CREATE TABLE audit_events (
    audit_id       UUID PRIMARY KEY,                -- idempotency key (publisher-supplied)
    event_type     VARCHAR(150)  NOT NULL,          -- e.g. login.failed, project.updated
    category       VARCHAR(20)   NOT NULL DEFAULT 'business'
                   CHECK (category IN ('security', 'business')),
    actor_user_id  UUID,                            -- required for user actions (validated in app)
    service_name   VARCHAR(100)  NOT NULL,          -- producing service (envelope source)
    project_id     UUID,                            -- required for project-scoped actions
    resource_type  VARCHAR(100)  NOT NULL,
    resource_id    VARCHAR(200),
    action         VARCHAR(100)  NOT NULL,
    outcome        VARCHAR(50)   NOT NULL,          -- success | failure | rejected | ...
    occurred_at    TIMESTAMPTZ   NOT NULL,
    recorded_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    correlation_id VARCHAR(100)  NOT NULL,
    trace_id       VARCHAR(100),                    -- Cloud Logging correlation, when available
    metadata       JSONB                            -- structured context (never secrets)
);

CREATE INDEX idx_audit_events_occurred   ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_events_project    ON audit_events (project_id, occurred_at DESC);
CREATE INDEX idx_audit_events_actor      ON audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_events_type       ON audit_events (event_type, occurred_at DESC);
CREATE INDEX idx_audit_events_category   ON audit_events (category, occurred_at DESC);
CREATE INDEX idx_audit_events_correlation ON audit_events (correlation_id);

-- Append-only is enforced IN THE DATABASE, not just by app discipline: UPDATE/DELETE
-- raise even for the owning role. (TRUNCATE is additionally revoked from non-owners;
-- cloud hardening adds an IAM-separated owner.)
CREATE OR REPLACE FUNCTION block_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% blocked)', TG_OP;
END $$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION block_audit_mutation();
