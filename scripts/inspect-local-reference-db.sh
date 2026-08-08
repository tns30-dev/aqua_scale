#!/usr/bin/env bash
# Read-only inspection helper for the second-round monolith/reference dataset.
#
# Defaults to the local Postgres database the updated monolith uses:
#   DB_NAME=aquaculture ./scripts/inspect-local-reference-db.sh

set -euo pipefail

DB_NAME="${DB_NAME:-aquaculture}"
PSQL="${PSQL:-psql}"

echo "Inspecting local reference database: $DB_NAME"
echo "Mode: read-only transaction"

"$PSQL" -X -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
\pset pager off
\pset null '(null)'
\timing off

BEGIN READ ONLY;

\echo
\echo '== Core table counts =='
select *
from (
  values
    ('projects', (select count(*)::bigint from public.projects)),
    ('ponds', (select count(*)::bigint from public.ponds)),
    ('users', (select count(*)::bigint from public.users)),
    ('profile_types', (select count(*)::bigint from public.profile_types)),
    ('cycles', (select count(*)::bigint from public.cycles)),
    ('cycle_daily_health', (select count(*)::bigint from public.cycle_daily_health)),
    ('cycle_stage_metrics', (select count(*)::bigint from public.cycle_stage_metrics)),
    ('feed_types', (select count(*)::bigint from public.feed_types)),
    ('feed_logs', (select count(*)::bigint from public.feed_logs)),
    ('treatments', (select count(*)::bigint from public.treatments)),
    ('pond_treatments', (select count(*)::bigint from public.pond_treatments)),
    ('sensor_types', (select count(*)::bigint from public.sensor_types)),
    ('iot_devices', (select count(*)::bigint from public.iot_devices)),
    ('project_sensors', (select count(*)::bigint from public.project_sensors)),
    ('sensor_readings', (select count(*)::bigint from public.sensor_readings)),
    ('sensor_messages', (select count(*)::bigint from public.sensor_messages)),
    ('alert_log', (select count(*)::bigint from public.alert_log)),
    ('project_energy_settings', (select count(*)::bigint from public.project_energy_settings)),
    ('project_parameter_settings', (select count(*)::bigint from public.project_parameter_settings)),
    ('project_visualisations', (select count(*)::bigint from public.project_visualisations))
) as counts(table_name, row_count)
order by table_name;

\echo
\echo '== Projects =='
select name, project_id
from public.projects
order by name;

\echo
\echo '== Demo Shrimp Farm pond coverage =='
with shrimp_project as (
  select project_id
  from public.projects
  where name = 'Demo Shrimp Farm'
)
select
  po.name as pond,
  po.pond_id,
  (select count(*) from public.sensor_readings sr where sr.pond_id = po.pond_id) as readings,
  (select min(sr.measured_at)::date from public.sensor_readings sr where sr.pond_id = po.pond_id) as first_reading,
  (select max(sr.measured_at)::date from public.sensor_readings sr where sr.pond_id = po.pond_id) as last_reading,
  (select count(*) from public.feed_logs fl where fl.pond_id = po.pond_id) as feed_logs,
  (select count(*) from public.pond_treatments pt where pt.pond_id = po.pond_id) as pond_treatments,
  (select count(*) from public.alert_log al where al.pond_id = po.pond_id) as alerts,
  (
    select count(*)
    from public.cycle_daily_health cdh
    join public.cycles c on c.cycle_id = cdh.cycle_id
    where c.pond_id = po.pond_id
  ) as daily_health_rows
from public.ponds po
join shrimp_project sp on sp.project_id = po.project_id
order by po.name;

\echo
\echo '== Demo Shrimp Farm monthly reading coverage =='
with shrimp_project as (
  select project_id
  from public.projects
  where name = 'Demo Shrimp Farm'
)
select
  to_char(date_trunc('month', sr.measured_at), 'YYYY-MM') as month,
  count(*) as readings,
  count(sr.electricity) as electricity,
  count(*) filter (
    where sr.ammonia is not null
       or sr.ammonium is not null
       or sr.tan is not null
  ) as ammonia_family,
  count(sr.nitrite) as nitrite
from public.sensor_readings sr
join shrimp_project sp on sp.project_id = sr.project_id
group by date_trunc('month', sr.measured_at)
order by date_trunc('month', sr.measured_at);

\echo
\echo '== Project-level feature coverage =='
select
  p.name as project,
  (select count(*) from public.ponds po where po.project_id = p.project_id) as ponds,
  (
    select count(*)
    from public.cycles c
    join public.ponds po on po.pond_id = c.pond_id
    where po.project_id = p.project_id
  ) as cycles,
  (
    select count(*)
    from public.feed_logs fl
    join public.ponds po on po.pond_id = fl.pond_id
    where po.project_id = p.project_id
  ) as feed_logs,
  (
    select count(*)
    from public.pond_treatments pt
    join public.ponds po on po.pond_id = pt.pond_id
    where po.project_id = p.project_id
  ) as pond_treatments,
  (select count(*) from public.alert_log al where al.project_id = p.project_id) as alerts,
  (
    select count(*)
    from public.cycle_daily_health cdh
    join public.cycles c on c.cycle_id = cdh.cycle_id
    join public.ponds po on po.pond_id = c.pond_id
    where po.project_id = p.project_id
  ) as daily_health_rows
from public.projects p
order by p.name;

\echo
\echo '== Sensor/device shape =='
select
  st.name as sensor_type,
  st.parameter_ids,
  count(ps.project_sensor_id) as project_sensor_mappings
from public.sensor_types st
left join public.project_sensors ps on ps.sensor_type_id = st.sensor_type_id
group by st.sensor_type_id, st.name, st.parameter_ids
order by st.name;

select
  iot.device_code,
  iot.device_name,
  iot.status,
  iot.is_active,
  count(ps.project_sensor_id) as project_sensor_mappings
from public.iot_devices iot
left join public.project_sensors ps on ps.iot_device_id = iot.iot_device_id
group by iot.iot_device_id, iot.device_code, iot.device_name, iot.status, iot.is_active
order by iot.device_code;

\echo
\echo '== User project access =='
select
  u.email,
  u.role,
  string_agg(p.name, ', ' order by p.name) as projects
from public.users u
left join public.user_projects up on up.user_id = u.user_id
left join public.projects p on p.project_id = up.project_id
group by u.user_id, u.email, u.role
order by u.email;

ROLLBACK;
SQL
