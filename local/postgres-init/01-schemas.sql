-- Service-owned schemas (mirrors Cloud SQL schema-per-service ownership;
-- see cooking_tracker/main/polyglot_persistence.md).
-- Each service's Flyway migrates ONLY its own schema. No cross-schema access in code.

CREATE SCHEMA IF NOT EXISTS identity_access;
CREATE SCHEMA IF NOT EXISTS project;
CREATE SCHEMA IF NOT EXISTS pond;
CREATE SCHEMA IF NOT EXISTS sensor;
CREATE SCHEMA IF NOT EXISTS ingestion;     -- parsed-reading demo store (Bigtable is the raw target)
CREATE SCHEMA IF NOT EXISTS notification;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;     -- generated read models only, never source-of-truth config

-- One DB role per service (local convenience; cloud uses per-service DB users + IAM).
DO $$
DECLARE
  svc TEXT;
BEGIN
  FOREACH svc IN ARRAY ARRAY['identity_access','project','pond','sensor','ingestion','notification','audit','analytics']
  LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = svc || '_svc') THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', svc || '_svc', svc || '_local');
    END IF;
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO %I', svc, svc || '_svc');
    EXECUTE format('ALTER ROLE %I SET search_path TO %I', svc || '_svc', svc);
  END LOOP;
END $$;
