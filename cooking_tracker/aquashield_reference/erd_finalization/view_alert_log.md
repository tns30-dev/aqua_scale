# Alert Log — ERD Finalization

---

## Current State

### alerts — ❌ TO BE DROPPED (legacy, replaced by alert_log)

| Column | Type | Notes |
|--------|------|-------|
| alert_id | UUID (PK) | |
| pond_id | UUID (FK → ponds) | |
| parameter | VARCHAR(100) | |
| severity | VARCHAR(20) | |
| message | TEXT | |
| value | NUMERIC | |
| threshold_min | NUMERIC | |
| threshold_max | NUMERIC | |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |
| resolved_by | UUID (FK → users) | |
| resolved | BOOLEAN | |

**Why drop:** Model exists but is dormant. No view serves it. Data ingestion never creates Alert rows. The API endpoint `/api/alerts` actually serves `alert_log` data. Frontend expects AlertLog fields. Fully replaced by `alert_log`.

---

### alert_log (the active table)

| Column | Type | Notes |
|--------|------|-------|
| log_id | UUID (PK) | `gen_random_uuid()` |
| pond_id | UUID (FK → ponds) | ON DELETE CASCADE |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| timestamp | TIMESTAMP | Auto |
| log_type | VARCHAR(50) | `'alert'`, `'info'`, `'warning'` |
| message | TEXT | |
| severity | VARCHAR(50) | |
| acknowledged | BOOLEAN | Default false |
| acknowledged_by | UUID (FK → users) | |
| acknowledged_at | TIMESTAMP | |
| resolved | BOOLEAN | Default false |
| parameter | VARCHAR(100) | Parameter name that triggered |
| reading_timestamp | TIMESTAMPTZ | When sensor reading occurred |

**Indexes:** (pond, timestamp), log_type, (acknowledged, resolved)

---

## Refined Schema (1 Table)

### alert_log

| Column | Type | Notes |
|--------|------|-------|
| log_id | UUID (PK) | |
| pond_id | UUID (FK → ponds) | ON DELETE CASCADE |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| timestamp | TIMESTAMP | When alert was created |
| log_type | VARCHAR(50) | `'alert'`, `'info'`, `'warning'` |
| message | TEXT | Alert description |
| severity | VARCHAR(50) | Alert severity level |
| parameter | VARCHAR(100) | Parameter name that triggered (e.g., `'temperature'`, `'ph'`) |
| reading_timestamp | TIMESTAMPTZ | When the sensor reading occurred |
| acknowledged | BOOLEAN | Default false |
| acknowledged_by | UUID (FK → users) | Who acknowledged |
| acknowledged_at | TIMESTAMP | When acknowledged |
| resolved | BOOLEAN | Default false |
| resolved_by | UUID (FK → users) | **NEW** — Who resolved it |
| resolved_at | TIMESTAMP | **NEW** — When it was resolved |

> `alerts` table to be dropped. Added `resolved_by` and `resolved_at` for full resolution tracking.

---

## How It Works

```
1. IoT device sends sensor reading
   → Data ingestion consumer processes it

2. Consumer compares reading values against project_parameter_settings thresholds
   → If value < min_threshold OR value > max_threshold:
     → Creates alert_log entry with severity, message, parameter name

3. Frontend fetches /api/alerts (actually serves alert_log)
   → Displays alerts with acknowledge button

4. User acknowledges alert
   → PATCH /api/alerts/{logId}/acknowledge/
   → Sets acknowledged=true, acknowledged_by, acknowledged_at
```

---

## Relationships

```
alert_log (N) ←── (1) ponds
alert_log (N) ←── (1) projects
alert_log.acknowledged_by → users
```

---

*Last updated: April 17, 2026*
