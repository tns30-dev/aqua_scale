-- Second-round treatment management/stability sync.
-- Source monolith now manages treatments per project and records dose/cost snapshots
-- on treatment courses. Existing first-round seed rows are global; keep them readable
-- during migration by allowing NULL project_id while new API-created rows are project-scoped.

ALTER TABLE treatments
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS target_parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_unit VARCHAR(2) NOT NULL DEFAULT 'kg';

ALTER TABLE treatments DROP CONSTRAINT IF EXISTS treatments_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_treatments_project_code
    ON treatments (project_id, code)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_treatments_project_name
    ON treatments (project_id, name)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_treatments_global_code
    ON treatments (code)
    WHERE project_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_treatments_price_unit'
    ) THEN
        ALTER TABLE treatments
            ADD CONSTRAINT chk_treatments_price_unit CHECK (price_unit IN ('kg','l'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_treatments_unit_price_non_negative'
    ) THEN
        ALTER TABLE treatments
            ADD CONSTRAINT chk_treatments_unit_price_non_negative CHECK (unit_price >= 0);
    END IF;
END $$;

ALTER TABLE pond_treatments
    ADD COLUMN IF NOT EXISTS amount NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS unit VARCHAR(2),
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS price_unit VARCHAR(2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pond_treatments_amount_positive'
    ) THEN
        ALTER TABLE pond_treatments
            ADD CONSTRAINT chk_pond_treatments_amount_positive
            CHECK (amount IS NULL OR amount > 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pond_treatments_unit'
    ) THEN
        ALTER TABLE pond_treatments
            ADD CONSTRAINT chk_pond_treatments_unit
            CHECK (unit IS NULL OR unit IN ('g','kg','ml','l'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pond_treatments_price_unit'
    ) THEN
        ALTER TABLE pond_treatments
            ADD CONSTRAINT chk_pond_treatments_price_unit
            CHECK (price_unit IS NULL OR price_unit IN ('kg','l'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pond_treatments_amount_unit_pair'
    ) THEN
        ALTER TABLE pond_treatments
            ADD CONSTRAINT chk_pond_treatments_amount_unit_pair
            CHECK ((amount IS NULL AND unit IS NULL) OR (amount IS NOT NULL AND unit IS NOT NULL));
    END IF;
END $$;
