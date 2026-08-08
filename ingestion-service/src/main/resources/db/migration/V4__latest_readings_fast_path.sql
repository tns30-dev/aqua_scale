-- Speeds up Overview/Digital Twin latest-reading lookups under concurrent dashboard load.
CREATE INDEX IF NOT EXISTS ix_readings_project_pond_time
    ON sensor_readings (project_id, pond_id, measured_at DESC);
