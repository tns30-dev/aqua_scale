CREATE TABLE energy_hourly_readings (
    project_id   UUID NOT NULL,
    hour_start   TIMESTAMPTZ NOT NULL,
    kwh          DOUBLE PRECISION NOT NULL DEFAULT 0,
    sample_count BIGINT NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_energy_hourly_readings PRIMARY KEY (project_id, hour_start)
);

INSERT INTO energy_hourly_readings (project_id, hour_start, kwh, sample_count)
SELECT
    project_id,
    date_trunc('hour', measured_at) AS hour_start,
    sum((reading_values ->> 'electricity')::double precision) AS kwh,
    count(reading_values ->> 'electricity') AS sample_count
FROM sensor_readings
WHERE jsonb_exists(reading_values, 'electricity')
GROUP BY project_id, date_trunc('hour', measured_at);
