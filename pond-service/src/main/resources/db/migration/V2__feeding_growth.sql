-- Feeding & Growth second-round slice.
-- Service-owned translation of the monolith 2026-08-01 feeding schema delta.

ALTER TABLE cycles
    ADD COLUMN IF NOT EXISTS stocking_biomass_kg NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS harvest_biomass_kg NUMERIC(10,2);

ALTER TABLE cycles DROP CONSTRAINT IF EXISTS chk_cycles_stocking_biomass_nonneg;
ALTER TABLE cycles
    ADD CONSTRAINT chk_cycles_stocking_biomass_nonneg CHECK (stocking_biomass_kg >= 0);

ALTER TABLE cycles DROP CONSTRAINT IF EXISTS chk_cycles_harvest_biomass_nonneg;
ALTER TABLE cycles
    ADD CONSTRAINT chk_cycles_harvest_biomass_nonneg CHECK (harvest_biomass_kg >= 0);

CREATE TABLE IF NOT EXISTS feed_types (
    feed_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL,
    name         VARCHAR(100) NOT NULL,
    pack_kg      NUMERIC(7,2) NOT NULL,
    pack_price   NUMERIC(10,2) NOT NULL,
    currency     VARCHAR(3) NOT NULL DEFAULT 'SGD',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID
);

ALTER TABLE feed_types DROP CONSTRAINT IF EXISTS uq_feed_types_project_name;
ALTER TABLE feed_types
    ADD CONSTRAINT uq_feed_types_project_name UNIQUE (project_id, name);

ALTER TABLE feed_types DROP CONSTRAINT IF EXISTS chk_feed_types_pack_kg_pos;
ALTER TABLE feed_types
    ADD CONSTRAINT chk_feed_types_pack_kg_pos CHECK (pack_kg > 0);

ALTER TABLE feed_types DROP CONSTRAINT IF EXISTS chk_feed_types_pack_price_nonneg;
ALTER TABLE feed_types
    ADD CONSTRAINT chk_feed_types_pack_price_nonneg CHECK (pack_price >= 0);

CREATE TABLE IF NOT EXISTS feed_logs (
    feed_log_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pond_id      UUID NOT NULL REFERENCES ponds (pond_id) ON DELETE CASCADE,
    feed_type_id UUID NOT NULL REFERENCES feed_types (feed_type_id) ON DELETE RESTRICT,
    fed_on       DATE NOT NULL,
    fed_time     TIME,
    amount_kg    NUMERIC(7,2) NOT NULL,
    pack_kg      NUMERIC(7,2) NOT NULL,
    pack_price   NUMERIC(10,2) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID
);

ALTER TABLE feed_logs DROP CONSTRAINT IF EXISTS chk_feed_logs_amount_pos;
ALTER TABLE feed_logs
    ADD CONSTRAINT chk_feed_logs_amount_pos CHECK (amount_kg > 0);

ALTER TABLE feed_logs DROP CONSTRAINT IF EXISTS chk_feed_logs_pack_kg_pos;
ALTER TABLE feed_logs
    ADD CONSTRAINT chk_feed_logs_pack_kg_pos CHECK (pack_kg > 0);

ALTER TABLE feed_logs DROP CONSTRAINT IF EXISTS chk_feed_logs_pack_price_nonneg;
ALTER TABLE feed_logs
    ADD CONSTRAINT chk_feed_logs_pack_price_nonneg CHECK (pack_price >= 0);

CREATE INDEX IF NOT EXISTS ix_feed_logs_pond_fed_on
    ON feed_logs (pond_id, fed_on);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cycle_stage_metrics_cycle_stage
    ON cycle_stage_metrics (cycle_id, stage_name);
