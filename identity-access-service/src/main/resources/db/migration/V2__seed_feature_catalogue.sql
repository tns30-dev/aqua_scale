-- Default feature/action catalogue (parity with monolith fixtures used by
-- RBACService.get_default_access; see module_user test fixtures).
-- is_default=TRUE rows are granted to newly onboarded users when no explicit
-- feature_action_assigned is provided.

INSERT INTO feature_access (name, code, is_default) VALUES
    ('Overview',           'overview',          TRUE),
    ('Digital Twin',       'digital_twin',      TRUE),
    ('Real-time Forecast', 'realtime_forecast', TRUE),
    ('Historical Data',    'historical_data',   TRUE),
    ('Pond Comparison',    'pond_comparison',   TRUE),
    ('Energy',             'energy',            TRUE),
    ('User Management',    'user_management',   FALSE);

INSERT INTO action_control (feature_access_id, name, code, is_default)
SELECT f.feature_access_id, a.name, a.code, a.is_default
FROM (VALUES
    ('realtime_forecast', 'AI Forecast',       'ai_forecast',       TRUE),
    ('realtime_forecast', 'Schedule Forecast', 'schedule_forecast', TRUE),
    ('historical_data',   'Export Data',       'export_data',       TRUE),
    ('user_management',   'Onboard User',      'onboard_user',      FALSE)
) AS a(feature_code, name, code, is_default)
JOIN feature_access f ON f.code = a.feature_code;
