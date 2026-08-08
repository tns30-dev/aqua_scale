CREATE UNIQUE INDEX ux_alert_log_active_project_energy_hourly
    ON alert_log (project_id, parameter)
    WHERE pond_id IS NULL
      AND parameter = 'electricity_hourly'
      AND acknowledged = FALSE
      AND resolved = FALSE;
