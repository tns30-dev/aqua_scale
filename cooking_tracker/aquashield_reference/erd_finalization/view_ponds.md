# Ponds — ERD Finalization

---

## Current State

### ponds
| Column | Type | Notes |
|--------|------|-------|
| pond_id | UUID (PK) | `gen_random_uuid()` |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| name | VARCHAR(255) | |
| description | TEXT | |
| metadata | JSONB | `{company_name, gps_location, biomass_kg, growth_rate, ...}` |
| photo_url | TEXT | |

---

## Refined Schema (1 Table)

### ponds

| Column | Type | Notes |
|--------|------|-------|
| pond_id | UUID (PK) | |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| name | VARCHAR(255) | |
| description | TEXT | |
| metadata | JSONB | Flexible metadata (company_name, gps_location, biomass_kg, etc.) |
| photo_url | TEXT | URL/path to pond image |
| status | VARCHAR(20) | **NEW** — `'active'`, `'inactive'`, `'decommissioned'`. From earlier schema_refinement |
| created_at | TIMESTAMP | **NEW** |
| updated_at | TIMESTAMP | **NEW** |

**Added:** `status`, `created_at`, `updated_at` — from earlier schema refinement discussion.

---

## Use Case Mapping

From the use case diagram (System Administrator → View Ponds → Add/Modify Ponds):

| Use Case | Table/Column |
|----------|-------------|
| Assign/Modify Project | `ponds.project_id` (FK → projects) |
| Add/Modify name | `ponds.name` |
| Add/Modify description | `ponds.description` |
| Add/Modify metadata | `ponds.metadata` (JSONB) |
| Upload image | `ponds.photo_url` |

---

## Relationships

```
ponds (N) ←── (1) projects

ponds (1) ──→ (N) cycles
ponds (1) ──→ (N) project_sensors
ponds (1) ──→ (N) alerts
ponds (1) ──→ (N) alert_log
ponds (1) ──→ (N) sensor_readings
```

---

*Last updated: April 17, 2026*
