\if :{?ALLOW_BANGKA_DEMO_SEED}
\else
\error 'Refusing to run directly. Use scripts/seed-bangka-demo.sh with ALLOW_LOCAL_SQL_SEED=yes.'
\endif

BEGIN;

DO $$
DECLARE
  demo_project_id UUID;
  demo_project_count INTEGER;
  pond_count INTEGER;
  mapping_count INTEGER;
BEGIN
  IF current_database() <> 'aquashield' THEN
    RAISE EXCEPTION 'Refusing to seed database %. Expected aquashield.', current_database();
  END IF;

  SELECT count(*) INTO demo_project_count
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm';

  IF demo_project_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Demo Shrimp Farm project; found %.',
      demo_project_count;
  END IF;

  SELECT project_id INTO demo_project_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
  ORDER BY created_at
  LIMIT 1;

  IF demo_project_id IS NULL THEN
    RAISE EXCEPTION 'Demo Shrimp Farm does not exist. Run scripts/seed-bangka-demo.sh.';
  END IF;

  SELECT count(*) INTO pond_count
  FROM pond.ponds
  WHERE project_id = demo_project_id;

  IF pond_count < 5 THEN
    RAISE EXCEPTION 'Demo Shrimp Farm needs at least 5 ponds; found %.', pond_count;
  END IF;

  SELECT count(*) INTO mapping_count
  FROM sensor.project_sensors
  WHERE project_id = demo_project_id
    AND status = 'active'
    AND iot_device_id IS NOT NULL;

  IF mapping_count < 5 THEN
    RAISE EXCEPTION 'Demo Shrimp Farm needs at least 5 active device port mappings; found %.',
      mapping_count;
  END IF;
END $$;

-- Project-owned chart, threshold, and energy setup.
INSERT INTO project.project_visualisations
    (project_id, visualisation_type_id, enabled, flag, y_parameters, title)
SELECT pr.project_id, vt.visualisation_type_id, true, 0, vt.required_parameters, vt.name
FROM project.projects pr
CROSS JOIN project.visualisation_types vt
WHERE pr.name = 'Demo Shrimp Farm'
  AND NOT EXISTS (
    SELECT 1
    FROM project.project_visualisations pv
    WHERE pv.project_id = pr.project_id
      AND pv.visualisation_type_id = vt.visualisation_type_id
  );

WITH desired(code, min_threshold, max_threshold, is_key_parameter) AS (VALUES
  ('temperature', 26.0, 32.0, true),
  ('salinity', 18.0, 35.0, true),
  ('ph', 6.5, 8.5, true),
  ('dissolved_oxygen', 4.0, 9.5, true),
  ('ammonia', 0.0, 0.18, false),
  ('ammonium', 0.0, 5.5, false),
  ('nitrite', 0.0, 0.30, false),
  ('nitrate', 0.0, 90.0, false),
  ('alkalinity', 80.0, 170.0, false),
  ('total_hardness', 3500.0, 6500.0, false),
  ('total_vibrio_count', 0.0, 7000.0, false)
)
INSERT INTO project.project_parameter_settings
    (project_id, parameter_id, min_threshold, max_threshold, is_key_parameter)
SELECT pr.project_id, pt.parameter_id, d.min_threshold, d.max_threshold, d.is_key_parameter
FROM project.projects pr
JOIN desired d ON true
JOIN project.parameter_types pt ON pt.parameter_code = d.code
WHERE pr.name = 'Demo Shrimp Farm'
ON CONFLICT (project_id, parameter_id) DO UPDATE
SET min_threshold = EXCLUDED.min_threshold,
    max_threshold = EXCLUDED.max_threshold,
    is_key_parameter = EXCLUDED.is_key_parameter;

INSERT INTO project.project_energy_settings
    (project_id, type, unit, tariff_per_unit, currency, high_hourly_threshold,
     high_daily_threshold, manual_entry_enabled, notes)
SELECT project_id, 'electricity', 'kWh', 0.2500, 'USD', 2.000, 45.000, true,
       'BangKa-pattern demo seed: generated electricity; workbooks had no electricity column.'
FROM project.projects
WHERE name = 'Demo Shrimp Farm'
ON CONFLICT (project_id, type) DO UPDATE
SET tariff_per_unit = EXCLUDED.tariff_per_unit,
    currency = EXCLUDED.currency,
    high_hourly_threshold = EXCLUDED.high_hourly_threshold,
    high_daily_threshold = EXCLUDED.high_daily_threshold,
    manual_entry_enabled = EXCLUDED.manual_entry_enabled,
    notes = EXCLUDED.notes,
    updated_at = now();

-- Replace the second-round demo story for this one project only.
WITH demo AS (
  SELECT project_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
)
DELETE FROM notification.alert_log a
USING demo
WHERE a.project_id = demo.project_id
  AND a.message LIKE 'BangKa-pattern demo seed:%';

WITH demo AS (
  SELECT project_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
)
DELETE FROM ingestion.sensor_readings r
USING demo
WHERE r.project_id = demo.project_id
  AND r.measured_at >= TIMESTAMPTZ '2026-01-01 00:00+08';

DELETE FROM ingestion.sensor_messages
WHERE payload ->> 'seed' = 'bangka-demo-2026';

WITH demo_ponds AS (
  SELECT p.pond_id
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
DELETE FROM pond.feed_logs f
USING demo_ponds
WHERE f.pond_id = demo_ponds.pond_id;

WITH demo_ponds AS (
  SELECT p.pond_id
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
DELETE FROM pond.pond_treatments pt
USING demo_ponds
WHERE pt.pond_id = demo_ponds.pond_id;

WITH demo_cycles AS (
  SELECT c.cycle_id
  FROM pond.cycles c
  JOIN pond.ponds p ON p.pond_id = c.pond_id
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
DELETE FROM pond.cycle_daily_health h
USING demo_cycles
WHERE h.cycle_id = demo_cycles.cycle_id;

WITH demo_cycles AS (
  SELECT c.cycle_id
  FROM pond.cycles c
  JOIN pond.ponds p ON p.pond_id = c.pond_id
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
DELETE FROM pond.cycle_stage_metrics m
USING demo_cycles
WHERE m.cycle_id = demo_cycles.cycle_id;

WITH demo_ponds AS (
  SELECT p.pond_id
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
DELETE FROM pond.cycles c
USING demo_ponds
WHERE c.pond_id = demo_ponds.pond_id;

WITH demo AS (
  SELECT project_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
)
DELETE FROM pond.feed_types ft
USING demo
WHERE ft.project_id = demo.project_id;

-- BangKa-rhythm cycles: completed cycle, short gap, then ongoing cycle per pond.
WITH ordered_ponds AS (
  SELECT p.pond_id, pr.project_owner_id,
         (row_number() OVER (ORDER BY p.name) - 1)::integer AS pond_offset
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
INSERT INTO pond.cycles
    (pond_id, start_date, end_date, status, stocking_biomass_kg, harvest_biomass_kg, created_by)
SELECT pond_id,
       DATE '2026-01-05' + pond_offset,
       DATE '2026-01-05' + pond_offset + 100,
       'completed',
       0.50,
       3800 + pond_offset * 220,
       project_owner_id
FROM ordered_ponds;

WITH ordered_ponds AS (
  SELECT p.pond_id, pr.project_owner_id,
         (row_number() OVER (ORDER BY p.name) - 1)::integer AS pond_offset
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
INSERT INTO pond.cycles
    (pond_id, start_date, end_date, status, stocking_biomass_kg, created_by)
SELECT pond_id,
       DATE '2026-05-05' + pond_offset,
       NULL,
       'ongoing',
       0.50,
       project_owner_id
FROM ordered_ponds;

-- Feed catalogue and logs calibrated from BangKa feed curves, scaled for the demo ponds.
WITH demo AS (
  SELECT project_id, project_owner_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
)
INSERT INTO pond.feed_types
    (project_id, name, pack_kg, pack_price, currency, active, created_by, updated_by)
SELECT demo.project_id, feed.name, 25.00, 62.50, 'SGD', true,
       demo.project_owner_id, demo.project_owner_id
FROM demo
CROSS JOIN (VALUES ('SA 00'), ('SA 01'), ('SA 02 P')) AS feed(name);

WITH ordered_ponds AS (
  SELECT p.pond_id,
         (row_number() OVER (ORDER BY p.name) - 1)::float AS pond_offset
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
),
curve(decile, kg) AS (VALUES
  (0, 9.5), (1, 20.3), (2, 26.3), (3, 46.5), (4, 66.0), (5, 84.8),
  (6, 94.2), (7, 99.4), (8, 98.7), (9, 91.3), (10, 80.4)
)
INSERT INTO pond.feed_logs
    (pond_id, feed_type_id, fed_on, fed_time, amount_kg, pack_kg, pack_price, created_by)
SELECT p.pond_id,
       ft.feed_type_id,
       d.day::date,
       TIME '08:00',
       round((curve.kg * 0.4
              * (1 + 0.06 * sin(((d.day::date - cy.start_date)) / 5.0 + op.pond_offset)))
             ::numeric, 2),
       ft.pack_kg,
       ft.pack_price,
       pr.project_owner_id
FROM ordered_ponds op
JOIN pond.ponds p ON p.pond_id = op.pond_id
JOIN project.projects pr ON pr.project_id = p.project_id AND pr.name = 'Demo Shrimp Farm'
JOIN pond.cycles cy ON cy.pond_id = p.pond_id
CROSS JOIN generate_series(DATE '2026-01-01', current_date, interval '1 day') AS d(day)
JOIN LATERAL (
  SELECT LEAST((d.day::date - cy.start_date) / 10, 10) AS decile,
         (d.day::date - cy.start_date) AS doc
) doc ON true
JOIN curve ON curve.decile = doc.decile
JOIN LATERAL (
  SELECT feed_type_id, pack_kg, pack_price
  FROM pond.feed_types
  WHERE project_id = pr.project_id
    AND name = CASE
      WHEN doc.doc < 10 THEN 'SA 00'
      WHEN doc.doc < 30 THEN 'SA 01'
      ELSE 'SA 02 P'
    END
) ft ON true
WHERE d.day::date >= cy.start_date
  AND d.day::date <= coalesce(cy.end_date, current_date);

-- Treatment catalogue and overlapping course rhythm.
WITH demo AS (
  SELECT project_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
),
desired(code, name, target_parameters, unit_price, price_unit) AS (VALUES
  ('sanolife-pro-w', 'Sanolife PRO-W', '["ammonia","dissolved_oxygen"]'::jsonb, 18.50, 'kg'),
  ('omya', 'OMYA', '["ph","alkalinity"]'::jsonb, 12.00, 'kg'),
  ('molase', 'Molase', '["ammonia","nitrite"]'::jsonb, 8.00, 'l'),
  ('azomite', 'Azomite', '["alkalinity","total_hardness"]'::jsonb, 15.00, 'kg'),
  ('semen-putih', 'Semen Putih', '["ph","alkalinity"]'::jsonb, 9.00, 'kg'),
  ('cao', 'CaO', '["ph","alkalinity"]'::jsonb, 7.50, 'kg'),
  ('dolomite', 'Dolomite', '["ph","alkalinity","total_hardness"]'::jsonb, 6.75, 'kg'),
  ('probac', 'ProBac', '["ammonia","nitrite"]'::jsonb, 22.00, 'kg')
)
INSERT INTO pond.treatments
    (project_id, code, name, description, target_parameters, unit_price, price_unit)
SELECT demo.project_id, desired.code, desired.name,
       'BangKa-pattern demo treatment', desired.target_parameters,
       desired.unit_price, desired.price_unit
FROM demo
CROSS JOIN desired
WHERE NOT EXISTS (
  SELECT 1
  FROM pond.treatments t
  WHERE t.project_id = demo.project_id
    AND t.code = desired.code
);

WITH demo AS (
  SELECT project_id
  FROM project.projects
  WHERE name = 'Demo Shrimp Farm'
),
desired(code, name, target_parameters, unit_price, price_unit) AS (VALUES
  ('sanolife-pro-w', 'Sanolife PRO-W', '["ammonia","dissolved_oxygen"]'::jsonb, 18.50, 'kg'),
  ('omya', 'OMYA', '["ph","alkalinity"]'::jsonb, 12.00, 'kg'),
  ('molase', 'Molase', '["ammonia","nitrite"]'::jsonb, 8.00, 'l'),
  ('azomite', 'Azomite', '["alkalinity","total_hardness"]'::jsonb, 15.00, 'kg'),
  ('semen-putih', 'Semen Putih', '["ph","alkalinity"]'::jsonb, 9.00, 'kg'),
  ('cao', 'CaO', '["ph","alkalinity"]'::jsonb, 7.50, 'kg'),
  ('dolomite', 'Dolomite', '["ph","alkalinity","total_hardness"]'::jsonb, 6.75, 'kg'),
  ('probac', 'ProBac', '["ammonia","nitrite"]'::jsonb, 22.00, 'kg')
)
UPDATE pond.treatments t
SET name = desired.name,
    description = 'BangKa-pattern demo treatment',
    target_parameters = desired.target_parameters,
    unit_price = desired.unit_price,
    price_unit = desired.price_unit,
    updated_at = now()
FROM demo, desired
WHERE t.project_id = demo.project_id
  AND t.code = desired.code;

WITH ordered_ponds AS (
  SELECT p.pond_id,
         (row_number() OVER (ORDER BY p.name) - 1)::integer AS pond_offset
  FROM pond.ponds p
  JOIN project.projects pr ON pr.project_id = p.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
),
plan(product, start_offset, len_days, amount, unit) AS (VALUES
  ('Sanolife PRO-W', 3, 8, 7.5, 'kg'),
  ('OMYA', 8, 5, 5.0, 'kg'),
  ('Molase', 13, 4, 8.0, 'l'),
  ('CaO', 17, 2, 4.0, 'kg'),
  ('Dolomite', 22, 2, 5.0, 'kg'),
  ('Azomite', 27, 5, 6.0, 'kg'),
  ('OMYA', 34, 5, 5.0, 'kg'),
  ('Sanolife PRO-W', 38, 8, 7.5, 'kg'),
  ('Semen Putih', 47, 3, 4.5, 'kg'),
  ('OMYA', 54, 5, 5.0, 'kg'),
  ('Molase', 60, 4, 8.0, 'l'),
  ('Azomite', 67, 5, 6.0, 'kg'),
  ('Sanolife PRO-W', 74, 8, 7.5, 'kg'),
  ('Semen Putih', 82, 3, 4.5, 'kg'),
  ('OMYA', 90, 5, 5.0, 'kg'),
  ('CaO', 96, 2, 4.0, 'kg')
)
INSERT INTO pond.pond_treatments
    (pond_id, treatment_id, started_at, ended_at, notes, amount, unit, unit_price,
     price_unit, created_by)
SELECT p.pond_id,
       t.treatment_id,
       cy.start_date + plan.start_offset + op.pond_offset,
       LEAST(cy.start_date + plan.start_offset + op.pond_offset + plan.len_days - 1,
             coalesce(cy.end_date, current_date)),
       'BangKa-pattern demo seed: overlapping treatment course',
       plan.amount,
       plan.unit,
       t.unit_price,
       t.price_unit,
       pr.project_owner_id
FROM ordered_ponds op
JOIN pond.ponds p ON p.pond_id = op.pond_id
JOIN project.projects pr ON pr.project_id = p.project_id AND pr.name = 'Demo Shrimp Farm'
JOIN pond.cycles cy ON cy.pond_id = p.pond_id
CROSS JOIN plan
JOIN pond.treatments t ON t.project_id = pr.project_id AND t.name = plan.product
WHERE cy.start_date + plan.start_offset + op.pond_offset <= coalesce(cy.end_date, current_date)
  AND LEAST(cy.start_date + plan.start_offset + op.pond_offset + plan.len_days - 1,
            coalesce(cy.end_date, current_date)) <= current_date;

-- Hourly readings with one message per row, translated to the target JSONB ingestion store.
WITH pond_set AS (
  SELECT pr.project_id, p.pond_id, p.name AS pond_name, ps.project_sensor_id,
         ps.port, d.iot_device_id, d.device_code,
         (row_number() OVER (ORDER BY p.name) - 1)::float AS pond_offset
  FROM project.projects pr
  JOIN pond.ponds p ON p.project_id = pr.project_id
  JOIN LATERAL (
    SELECT project_sensor_id, iot_device_id, port
    FROM sensor.project_sensors
    WHERE project_id = pr.project_id
      AND pond_id = p.pond_id
      AND status = 'active'
      AND iot_device_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) ps ON true
  JOIN sensor.iot_devices d ON d.iot_device_id = ps.iot_device_id
  WHERE pr.name = 'Demo Shrimp Farm'
),
gen AS (
  SELECT gen_random_uuid() AS message_id,
         pond_set.*,
         g.ts,
         row_number() OVER (ORDER BY g.ts, pond_set.pond_name) AS rn,
         extract(hour FROM g.ts AT TIME ZONE 'Asia/Singapore')::float AS hour_of_day,
         ((g.ts AT TIME ZONE 'Asia/Singapore')::date - DATE '2026-01-01')::float AS day_index
  FROM pond_set
  CROSS JOIN generate_series(
    TIMESTAMPTZ '2026-01-01 00:00+08',
    date_trunc('hour', now()),
    interval '1 hour'
  ) AS g(ts)
),
message_insert AS (
  INSERT INTO ingestion.sensor_messages
      (sensor_message_id, iot_device_id, device_code, seq_no, payload, received_at)
  SELECT message_id,
         iot_device_id,
         device_code,
         860000000000 + rn,
         jsonb_build_object(
           'seed', 'bangka-demo-2026',
           'source', 'BangKa-pattern generated demo',
           'port', port,
           'measured_at', ts,
           'schema', 'target-jsonb'
         ),
         ts
  FROM gen
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
       ts,
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
         'water_level',
           round((120 + 6 * sin(day_index / 16.0 + pond_offset))::numeric, 0),
         'tan',
           round(GREATEST(0, 1.5 + 1.2 * sin(day_index / 7.0 + pond_offset))::numeric, 2),
         'alkalinity',
           round((132 + 20 * sin(day_index / 9.0 + pond_offset))::numeric, 0),
         'calcium',
           round((325 + 40 * sin(day_index / 11.0 + pond_offset))::numeric, 0),
         'magnesium',
           round((1020 + 150 * sin(day_index / 13.0 + pond_offset))::numeric, 0),
         'nitrate',
           round(GREATEST(0, 19.8 + 18 * sin(day_index / 8.0 + pond_offset))::numeric, 1),
         'nitrite',
           round(GREATEST(0, 1.5 + 1.3 * sin(day_index / 6.5 + pond_offset))::numeric, 2),
         'ammonia',
           round(GREATEST(0, 0.044 + 0.05 * sin(day_index / 5.0 + pond_offset)
                          + 0.06 * sin(day_index / 23.0))::numeric, 3),
         'ammonium',
           round(GREATEST(0, 1.3 + 1.1 * sin(day_index / 7.5 + pond_offset))::numeric, 2),
         'ph_lab',
           round((7.8 + 0.2 * sin(day_index / 10.0 + pond_offset))::numeric, 2),
         'phosphate',
           round(GREATEST(0.05, 1.35 + 0.8 * sin(day_index / 12.0 + pond_offset))::numeric, 2),
         'total_hardness',
           round((5000 + 800 * sin(day_index / 14.0 + pond_offset))::numeric, 0),
         'total_vibrio_count',
           round(GREATEST(50, 2330 + 2000 * sin(day_index / 9.0 + pond_offset)))::integer,
         'total_bacteria_count',
           round(GREATEST(20000, 130000 + 90000 * sin(day_index / 11.0 + pond_offset)))::integer,
         'electricity',
           round((0.45 + 0.30 * sin(2 * pi() * (hour_of_day - 14) / 24)
                  + 0.10 * sin(day_index / 7.0 + pond_offset))::numeric, 3)
       ),
       ts
FROM gen
JOIN message_insert ON message_insert.sensor_message_id = gen.message_id;

WITH demo_ponds AS (
  SELECT pr.project_id, p.pond_id
  FROM project.projects pr
  JOIN pond.ponds p ON p.project_id = pr.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
)
UPDATE notification.alert_log a
SET resolved = true,
    resolved_at = coalesce(a.resolved_at, now())
FROM demo_ponds
WHERE a.project_id = demo_ponds.project_id
  AND a.pond_id = demo_ponds.pond_id
  AND a.parameter IN ('ammonia', 'nitrite')
  AND a.acknowledged = false
  AND a.resolved = false;

-- Seed alert occurrences for notification and daily-health demos. Historical rows are
-- resolved, with one active pond-scoped alert per pond left for the Alert Center.
WITH pond_set AS (
  SELECT pr.project_id, p.pond_id, p.name AS pond_name,
         (row_number() OVER (ORDER BY p.name) - 1)::integer AS pond_offset
  FROM project.projects pr
  JOIN pond.ponds p ON p.project_id = pr.project_id
  WHERE pr.name = 'Demo Shrimp Farm'
),
days AS (
  SELECT generate_series((current_date - 9)::timestamp, current_date::timestamp,
                         interval '1 day')::date AS d
),
planned AS (
  SELECT pond_set.*,
         days.d,
         CASE WHEN ((days.d - DATE '2026-01-01')::integer + pond_offset) % 3 = 0
              THEN 'alert' ELSE 'warning' END AS log_type,
         CASE WHEN ((days.d - DATE '2026-01-01')::integer + pond_offset) % 2 = 0
              THEN 'nitrite' ELSE 'ammonia' END AS parameter
  FROM pond_set
  CROSS JOIN days
)
INSERT INTO notification.alert_log
    (project_id, pond_id, pond_name, "timestamp", log_type, message, severity,
     acknowledged, resolved, parameter, reading_timestamp, resolved_at)
SELECT project_id,
       pond_id,
       pond_name,
       (d + TIME '10:00') AT TIME ZONE 'Asia/Singapore',
       log_type,
       'BangKa-pattern demo seed: ' || parameter || ' ' || log_type || ' on ' || pond_name,
       CASE WHEN log_type = 'alert' THEN 'critical' ELSE 'warning' END,
       false,
       d < current_date,
       parameter,
       (d + TIME '10:00') AT TIME ZONE 'Asia/Singapore',
       CASE WHEN d < current_date THEN (d + TIME '18:00') AT TIME ZONE 'Asia/Singapore' END
FROM planned;

COMMIT;

SELECT 'ponds' AS metric, count(*) AS value
FROM pond.ponds p
JOIN project.projects pr ON pr.project_id = p.project_id
WHERE pr.name = 'Demo Shrimp Farm'
UNION ALL
SELECT 'cycles', count(*)
FROM pond.cycles c
JOIN pond.ponds p ON p.pond_id = c.pond_id
JOIN project.projects pr ON pr.project_id = p.project_id
WHERE pr.name = 'Demo Shrimp Farm'
UNION ALL
SELECT 'feed_logs', count(*)
FROM pond.feed_logs f
JOIN pond.ponds p ON p.pond_id = f.pond_id
JOIN project.projects pr ON pr.project_id = p.project_id
WHERE pr.name = 'Demo Shrimp Farm'
UNION ALL
SELECT 'treatment_courses', count(*)
FROM pond.pond_treatments pt
JOIN pond.ponds p ON p.pond_id = pt.pond_id
JOIN project.projects pr ON pr.project_id = p.project_id
WHERE pr.name = 'Demo Shrimp Farm'
UNION ALL
SELECT 'readings', count(*)
FROM ingestion.sensor_readings r
JOIN project.projects pr ON pr.project_id = r.project_id
WHERE pr.name = 'Demo Shrimp Farm'
UNION ALL
SELECT 'sensor_messages', count(*)
FROM ingestion.sensor_messages
WHERE payload ->> 'seed' = 'bangka-demo-2026'
UNION ALL
SELECT 'seed_alerts', count(*)
FROM notification.alert_log a
JOIN project.projects pr ON pr.project_id = a.project_id
WHERE pr.name = 'Demo Shrimp Farm'
  AND a.message LIKE 'BangKa-pattern demo seed:%';

SELECT date_trunc('month', measured_at AT TIME ZONE 'Asia/Singapore')::date AS month,
       count(*) AS readings,
       count(DISTINCT pond_id) AS ponds
FROM ingestion.sensor_readings r
JOIN project.projects pr ON pr.project_id = r.project_id
WHERE pr.name = 'Demo Shrimp Farm'
GROUP BY 1
ORDER BY 1;
