-- Chart configuration ownership (spec: main/analytics_service.md "Chart config ownership:
-- Prefer Project Service ownership; Analytics calls Project Service over gRPC").
-- DDL parity: monolith public.visualisation_types / public.project_visualisations.

CREATE TABLE visualisation_types (
    visualisation_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    required_parameters   UUID[],
    chart_type            VARCHAR(100)
);

CREATE TABLE project_visualisations (
    project_visualisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id               UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    visualisation_type_id    UUID NOT NULL REFERENCES visualisation_types (visualisation_type_id),
    enabled                  BOOLEAN DEFAULT TRUE,
    flag                     INTEGER CHECK (flag IN (0, 1, 2)),
    x_parameters             UUID[],
    y_parameters             UUID[],
    title                    VARCHAR(255)
);

CREATE INDEX idx_project_visualisations_project ON project_visualisations (project_id);

-- Catalogue seed — the 8 chart types the monolith engine dispatches on. The `name`
-- strings are the engine's case-sensitive join keys (chart_service.py:113-160); exact.
-- required_parameters mirror the monolith seeds (007/013/015 nodejs migrations).
INSERT INTO visualisation_types (name, description, required_parameters, chart_type) VALUES
    ('Multi-Parameter Trends',
     '30-90 day comparison of multiple water quality parameters on same timeline.',
     ARRAY(SELECT parameter_id FROM parameter_types
           WHERE parameter_code IN ('temperature', 'ph', 'salinity', 'ammonia')),
     'line'),
    ('Parameter Correlation Heatmap',
     'Statistical correlation matrix between monitored water quality parameters.',
     ARRAY(SELECT parameter_id FROM parameter_types
           WHERE parameter_code IN ('temperature', 'salinity', 'ph', 'nitrate', 'ammonia',
                                    'alkalinity', 'total_vibrio_count')),
     'heatmap'),
    ('Historical Trends of Key Parameters',
     'Long-term date-based trends showing seasonal and temporal patterns.',
     ARRAY(SELECT parameter_id FROM parameter_types
           WHERE parameter_code IN ('temperature', 'salinity', 'ph')),
     'line'),
    ('Nitrogen Cycle Monitoring',
     'Nitrogen compound tracking (ammonia, nitrite, nitrate, ammonium, TAN).',
     ARRAY(SELECT parameter_id FROM parameter_types
           WHERE parameter_code IN ('ammonia', 'nitrite', 'nitrate', 'ammonium', 'tan')),
     'line'),
    ('Temperature Trend Analysis',
     'Single-parameter temperature trend.',
     ARRAY(SELECT parameter_id FROM parameter_types WHERE parameter_code = 'temperature'),
     'line'),
    ('Dissolved Oxygen Monitoring',
     'Single-parameter dissolved oxygen trend.',
     ARRAY(SELECT parameter_id FROM parameter_types WHERE parameter_code = 'dissolved_oxygen'),
     'line'),
    ('Disease Risk Assessment',
     'Disease risk indicators (engine stub — returns empty series; parity).',
     NULL,
     'line'),
    ('Water Quality Index',
     'Composite water quality index (engine stub — returns empty series; parity).',
     NULL,
     'line');
