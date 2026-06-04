-- Pond Service schema (pond) — DDL-authoritative parity port of module_pond.
-- Documented divergences (parity spec DIV-1..8):
--   * photo_url EXPOSED (existed in DDL, silently dropped by the monolith API)
--   * ponds.status CHECK added (monolith enum was app-only; we now have write APIs)
--   * no created_by/updated_by on ponds / daily_health / stage_metrics (DDL truth —
--     the monolith model declared them but the tables never had them)
--   * cycle_daily_health day_number range is 1..200 (DDL CHECK; docstring said 192)
--   * NO unique on (cycle, stage_name) — DDL allows duplicates (parity)
--   * NO one-ongoing-cycle-per-pond constraint (parity: monolith never enforced it)
--   * timestamptz everywhere (new-arch tz consistency)

CREATE TABLE ponds (
    pond_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL,                       -- cross-service ref (Project Service)
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- gps/biomass/company etc live here
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    photo_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ponds_status CHECK (status IN
        ('active','draining','cleaning','maintenance','decommissioned'))
);

CREATE INDEX ix_ponds_project ON ponds (project_id);

CREATE TABLE cycles (
    cycle_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pond_id    UUID NOT NULL REFERENCES ponds (pond_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date   DATE,                                  -- NULL = ongoing
    status     VARCHAR(20) NOT NULL DEFAULT 'ongoing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT chk_cycles_status CHECK (status IN ('ongoing','completed','terminated'))
);

CREATE INDEX idx_cycles_pond_start_date ON cycles (pond_id, start_date DESC);

CREATE TABLE cycle_daily_health (
    health_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id      UUID NOT NULL REFERENCES cycles (cycle_id) ON DELETE CASCADE,
    day_number    INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 200),
    date          DATE NOT NULL,
    health_status VARCHAR(20) CHECK (health_status IN
        ('excellent','good','fair','poor','future')),
    alert_count   INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cycle_daily_health UNIQUE (cycle_id, day_number)
);

CREATE TABLE cycle_stage_metrics (
    metric_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id      UUID NOT NULL REFERENCES cycles (cycle_id) ON DELETE CASCADE,
    stage_name    VARCHAR(100),
    -- {"param_code": {"avg": x, "min": y, "max": z}} per parameter
    metrics       JSONB,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cycle_stage_metrics_cycle ON cycle_stage_metrics (cycle_id);

CREATE TABLE treatments (
    treatment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pond_treatments (
    pond_treatment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pond_id      UUID NOT NULL REFERENCES ponds (pond_id) ON DELETE CASCADE,
    -- PARITY: NO ACTION/PROTECT — a referenced treatment cannot be deleted
    treatment_id UUID NOT NULL REFERENCES treatments (treatment_id),
    started_at   DATE NOT NULL,
    ended_at     DATE,                                -- NULL = active (derived is_active)
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID
);

CREATE INDEX idx_pond_treatments_pond ON pond_treatments (pond_id);
CREATE INDEX idx_pond_treatments_active_by_pond ON pond_treatments (pond_id)
    WHERE ended_at IS NULL;
