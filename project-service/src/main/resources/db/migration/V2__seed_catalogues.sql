-- Parameter catalogue + profile types (parity with monolith fixtures/seed_demo_data.py).

INSERT INTO parameter_types (parameter_name, parameter_code, unit, data_type) VALUES
    ('Temperature',          'temperature',          '°C',    'float'),
    ('Salinity',             'salinity',             'ppt',   'float'),
    ('pH',                   'ph',                   '',      'float'),
    ('Water Level',          'water_level',          'm',     'float'),
    ('Dissolved Oxygen',     'dissolved_oxygen',     'mg/L',  'float'),
    ('Turbidity',            'turbidity',            'NTU',   'float'),
    ('Electricity',          'electricity',          'kWh',   'float'),
    ('Nitrate',              'nitrate',              'mg/L',  'float'),
    ('Nitrite',              'nitrite',              'mg/L',  'float'),
    ('Ammonia',              'ammonia',              'mg/L',  'float'),
    ('Ammonium',             'ammonium',             'mg/L',  'float'),
    ('Alkalinity',           'alkalinity',           'mg/L',  'float'),
    ('Calcium',              'calcium',              'mg/L',  'float'),
    ('Magnesium',            'magnesium',            'mg/L',  'float'),
    ('Phosphate',            'phosphate',            'mg/L',  'float'),
    ('Total Hardness',       'total_hardness',       'mg/L',  'float'),
    ('Hydrogen Sulfide',     'hydrogen_sulfide',     'mg/L',  'float'),
    ('TAN',                  'tan',                  'mg/L',  'float'),
    ('Carbonate',            'carbonate',            'mg/L',  'float'),
    ('Bicarbonate',          'bicarbonate',          'mg/L',  'float'),
    ('Total Vibrio Count',   'total_vibrio_count',   'CFU/mL','integer'),
    ('Total Bacteria Count', 'total_bacteria_count', 'CFU/mL','integer');

-- Profile templates (stage_config inner keys are camelCase by design — parity)
INSERT INTO profile_types (name, code, description, stage_config, key_parameter_indicators) VALUES
    ('shrimp', 'shrimp', 'Shrimp grow-out farming',
     '[{"name":"Post-Larvae Stocking","startDay":1,"endDay":30},{"name":"Growth Phase","startDay":31,"endDay":60},{"name":"Pre-Harvest","startDay":61,"endDay":90}]'::jsonb,
     ARRAY['temperature','salinity','dissolved_oxygen','ph']),
    ('fish', 'fish', 'Fish farming',
     '[{"name":"Fingerling","startDay":1,"endDay":45},{"name":"Juvenile","startDay":46,"endDay":120},{"name":"Grow-Out","startDay":121,"endDay":180}]'::jsonb,
     ARRAY['temperature','dissolved_oxygen','ph','ammonia']),
    ('crab_hatchery', 'crab_hatchery', 'Crab hatchery operation',
     '[{"name":"Larval","startDay":1,"endDay":21},{"name":"Megalopa","startDay":22,"endDay":35},{"name":"Crablet","startDay":36,"endDay":128},{"name":"Nursery","startDay":129,"endDay":192}]'::jsonb,
     ARRAY['salinity','temperature','ph','dissolved_oxygen']),
    ('treatment', 'treatment', 'Water treatment facility',
     '[]'::jsonb,
     ARRAY['ph','turbidity','total_bacteria_count']);
