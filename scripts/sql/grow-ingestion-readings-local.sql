\if :{?ALLOW_AQUASHIELD_PERF_GROWTH}
\else
\echo 'Refusing to run directly. Use scripts/grow-local-performance-data.sh with ALLOW_LOCAL_PERF_GROWTH=yes.'
\quit 2
\endif

BEGIN;

SET LOCAL aquashield.project_name = :'project_name';
SET LOCAL aquashield.target_rows = :'target_rows';
SET LOCAL aquashield.measure_end_date = :'measure_end_date';
SET LOCAL aquashield.interval_seconds = :'interval_seconds';

DO $$
DECLARE
  target_rows BIGINT := current_setting('aquashield.target_rows')::bigint;
  project_name TEXT := current_setting('aquashield.project_name');
  project_count INTEGER;
  mapping_count INTEGER;
BEGIN
  IF current_database() <> 'aquashield' THEN
    RAISE EXCEPTION 'Refusing to grow database %. Expected aquashield.', current_database();
  END IF;

  IF target_rows < 1 THEN
    RAISE EXCEPTION 'target_rows must be positive, got %.', target_rows;
  END IF;

  SELECT count(*) INTO project_count
  FROM project.projects
  WHERE name = project_name;

  IF project_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one project named %, found %.', project_name, project_count;
  END IF;

  SELECT count(*) INTO mapping_count
  FROM project.projects pr
  JOIN sensor.project_sensors ps ON ps.project_id = pr.project_id
  WHERE pr.name = project_name
    AND ps.status = 'active'
    AND ps.iot_device_id IS NOT NULL
    AND ps.pond_id IS NOT NULL;

  IF mapping_count < 2 THEN
    RAISE EXCEPTION 'Project % needs at least 2 active pond sensor mappings; found %.',
      project_name, mapping_count;
  END IF;
END $$;

WITH settings AS (
  SELECT
    current_setting('aquashield.project_name')::text AS project_name,
    current_setting('aquashield.target_rows')::bigint AS target_rows,
    current_setting('aquashield.measure_end_date')::date AS measure_end_date,
    current_setting('aquashield.interval_seconds')::integer AS interval_seconds
),
project_scope AS (
  SELECT pr.project_id, settings.*
  FROM project.projects pr
  JOIN settings ON settings.project_name = pr.name
),
current_level AS (
  SELECT count(*)::bigint AS rows_now
  FROM ingestion.sensor_readings r
  JOIN project_scope ps ON ps.project_id = r.project_id
),
needed AS (
  SELECT GREATEST(0, project_scope.target_rows - current_level.rows_now)::bigint AS rows_to_add,
         current_level.rows_now,
         project_scope.*
  FROM project_scope
  CROSS JOIN current_level
),
mapping_set AS (
  SELECT ps.project_id,
         p.pond_id,
         p.name AS pond_name,
         s.project_sensor_id,
         s.iot_device_id,
         s.port,
         d.device_code,
         row_number() OVER (ORDER BY p.name, s.port) AS mapping_no,
         count(*) OVER () AS mapping_count,
         (row_number() OVER (ORDER BY p.name, s.port) - 1)::float AS pond_offset
  FROM project_scope ps
  JOIN pond.ponds p ON p.project_id = ps.project_id
  JOIN sensor.project_sensors s ON s.project_id = ps.project_id
                           AND s.pond_id = p.pond_id
                           AND s.status = 'active'
                           AND s.iot_device_id IS NOT NULL
  JOIN sensor.iot_devices d ON d.iot_device_id = s.iot_device_id
),
high_water AS (
  SELECT coalesce(max(seq_no), 900000000000)::bigint AS max_seq
  FROM ingestion.sensor_messages
),
to_insert AS (
  SELECT gen.n,
         gen_random_uuid() AS message_id,
         mapping_set.*,
         high_water.max_seq + gen.n AS seq_no,
         (
           (needed.measure_end_date + TIME '23:59:30') AT TIME ZONE 'Asia/Singapore'
           - ((ceil(gen.n::numeric / mapping_set.mapping_count) - 1)
              * make_interval(secs => needed.interval_seconds))
         ) AS measured_at,
         needed.rows_now,
         needed.rows_to_add
  FROM needed
  JOIN high_water ON true
  JOIN generate_series(1::bigint, needed.rows_to_add) AS gen(n) ON needed.rows_to_add > 0
  JOIN mapping_set
    ON mapping_set.mapping_no = ((gen.n - 1) % mapping_set.mapping_count) + 1
),
features AS (
  SELECT *,
         extract(hour FROM measured_at AT TIME ZONE 'Asia/Singapore')::float AS hour_of_day,
         ((measured_at AT TIME ZONE 'Asia/Singapore')::date - DATE '2026-01-01')::float AS day_index
  FROM to_insert
),
message_insert AS (
  INSERT INTO ingestion.sensor_messages
      (sensor_message_id, iot_device_id, device_code, seq_no, payload, received_at)
  SELECT message_id,
         iot_device_id,
         device_code,
         seq_no,
         jsonb_build_object(
           'seed', 'performance-growth-2026',
           'source', 'microservice local growth generator',
           'port', port,
           'measured_at', measured_at,
           'target_rows', rows_now + rows_to_add,
           'schema', 'target-jsonb'
         ),
         measured_at
  FROM features
  RETURNING sensor_message_id
)
INSERT INTO ingestion.sensor_readings
    (sensor_message_id, project_id, pond_id, project_sensor_id, port,
     measured_at, reading_values, created_at)
SELECT message_id,
       project_id,
       pond_id,
       project_sensor_id,
       port,
       measured_at,
       jsonb_build_object(
         'temperature',
           round((29.4 + 0.92 * sin(2 * pi() * (hour_of_day - 15) / 24)
                  + 0.60 * sin(day_index / 9.0 + pond_offset))::numeric, 1),
         'salinity',
           round((25.6 + 3.0 * sin(day_index / 19.0 + pond_offset))::numeric, 1),
         'ph',
           round((8.05 + 0.17 * sin(2 * pi() * (hour_of_day - 15) / 24)
                  + 0.15 * sin(day_index / 6.0 + pond_offset))::numeric, 2),
         'dissolved_oxygen',
           round((6.35 + 0.93 * sin(2 * pi() * (hour_of_day - 15) / 24)
                  + 0.70 * sin(day_index / 7.0 + pond_offset))::numeric, 2),
         'ammonia',
           round(GREATEST(0, 0.044 + 0.05 * sin(day_index / 5.0 + pond_offset)
                          + 0.06 * sin(day_index / 23.0))::numeric, 3),
         'ammonium',
           round(GREATEST(0, 1.3 + 1.1 * sin(day_index / 7.5 + pond_offset))::numeric, 2),
         'nitrite',
           round(GREATEST(0, 1.5 + 1.3 * sin(day_index / 6.5 + pond_offset))::numeric, 2),
         'nitrate',
           round(GREATEST(0, 19.8 + 18 * sin(day_index / 8.0 + pond_offset))::numeric, 1),
         'alkalinity',
           round((132 + 20 * sin(day_index / 9.0 + pond_offset))::numeric, 0),
         'turbidity',
           round((24 + 13 * sin(day_index / 10.0 + pond_offset))::numeric, 1),
         'electricity',
           round((0.45 + 0.30 * sin(2 * pi() * (hour_of_day - 14) / 24)
                  + 0.10 * sin(day_index / 7.0 + pond_offset))::numeric, 3)
       ),
       measured_at
FROM features
JOIN message_insert ON message_insert.sensor_message_id = features.message_id;

DO $$
BEGIN
  IF to_regclass('ingestion.energy_hourly_readings') IS NOT NULL THEN
    TRUNCATE TABLE ingestion.energy_hourly_readings;

    INSERT INTO ingestion.energy_hourly_readings
        (project_id, hour_start, kwh, sample_count, updated_at)
    SELECT project_id,
           date_trunc('hour', measured_at) AS hour_start,
           sum((reading_values ->> 'electricity')::double precision) AS kwh,
           count(reading_values ->> 'electricity') AS sample_count,
           now()
    FROM ingestion.sensor_readings
    WHERE jsonb_exists(reading_values, 'electricity')
    GROUP BY project_id, date_trunc('hour', measured_at);

    ANALYZE ingestion.energy_hourly_readings;
  END IF;
END $$;

ANALYZE ingestion.sensor_messages;
ANALYZE ingestion.sensor_readings;

WITH settings AS (
  SELECT current_setting('aquashield.project_name')::text AS project_name
),
project_scope AS (
  SELECT pr.project_id, pr.name
  FROM project.projects pr
  JOIN settings ON settings.project_name = pr.name
)
SELECT
  project_scope.name AS project,
  count(*) AS total_readings,
  min(r.measured_at) AS first_reading,
  max(r.measured_at) AS last_reading,
  count(*) FILTER (
    WHERE r.measured_at >= (current_setting('aquashield.measure_end_date')::date - interval '30 days')
      AND r.measured_at < (current_setting('aquashield.measure_end_date')::date + interval '1 day')
  ) AS measured_window_readings
FROM project_scope
JOIN ingestion.sensor_readings r ON r.project_id = project_scope.project_id
GROUP BY project_scope.name;

COMMIT;
