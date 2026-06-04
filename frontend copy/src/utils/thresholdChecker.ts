import type { AlertInfo, SensorParameters } from '../types';

const DEFAULT_THRESHOLDS: Record<string, { min: number; max: number }> = {
  temperature: { min: 26, max: 31 },
  ph: { min: 7.0, max: 8.5 },
  salinity: { min: 15, max: 25 },
  dissolved_oxygen: { min: 5, max: 10 },
  turbidity: { min: 0, max: 15 },
  ammonia: { min: 0, max: 0.5 },
  nitrate: { min: 0, max: 20 },
  nitrite: { min: 0, max: 0.5 },
  ammonium: { min: 0, max: 0.5 },
  phosphate: { min: 0, max: 1.0 },
  calcium: { min: 200, max: 500 },
  magnesium: { min: 20, max: 60 },
  carbonate: { min: 40, max: 120 },
  bicarbonate: { min: 80, max: 200 },
  total_hardness: { min: 100, max: 300 },
  alkalinity: { min: 80, max: 200 },
  tan: { min: 0, max: 2.0 },
  hydrogen_sulfide: { min: 0, max: 0.05 },
  total_vibrio_count: { min: 0, max: 1000 },
  total_bacteria_count: { min: 0, max: 10000 },
};

export function checkParameterStatus(
  parameterName: string,
  value: number
): 'normal' | 'critical' {
  if (!Number.isFinite(value)) return 'normal';
  const threshold = DEFAULT_THRESHOLDS[parameterName];
  if (!threshold) return 'normal';

  // Only critical or normal (no warning)
  if (value < threshold.min || value > threshold.max) {
    return 'critical';
  }

  return 'normal';
}

export function getParameterLabel(key: string): string {
  const labels: Record<string, string> = {
    temperature: 'Temperature',
    ph: 'pH Level',
    salinity: 'Salinity',
    dissolved_oxygen: 'Dissolved Oxygen',
    turbidity: 'Turbidity',
    ammonia: 'Ammonia',
    nitrate: 'Nitrate',
    nitrite: 'Nitrite',
    ammonium: 'Ammonium',
    phosphate: 'Phosphate',
    calcium: 'Calcium',
    magnesium: 'Magnesium',
    carbonate: 'Carbonate',
    bicarbonate: 'Bicarbonate',
    total_hardness: 'Total Hardness',
    alkalinity: 'Alkalinity',
    hydrogen_sulfide: 'Hydrogen Sulfide',
    total_vibrio_count: 'Vibrio Count',
    total_bacteria_count: 'Total Bacteria',
    tan: 'TAN',
    water_level: 'Water Level',
    ph_lab: 'pH (Lab)',
  };
  return (
    labels[key] ||
    key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

export function getParameterUnit(key: string): string {
  const units: Record<string, string> = {
    temperature: '°C',
    ph: '',
    salinity: 'ppt',
    dissolved_oxygen: 'mg/L',
    turbidity: 'NTU',
    ammonia: 'mg/L',
    nitrate: 'mg/L',
    nitrite: 'mg/L',
    ammonium: 'mg/L',
    phosphate: 'mg/L',
    calcium: 'mg/L',
    magnesium: 'mg/L',
    carbonate: 'mg/L',
    bicarbonate: 'mg/L',
    total_hardness: 'mg/L',
    alkalinity: 'mg/L',
    hydrogen_sulfide: 'mg/L',
    total_vibrio_count: 'CFU/mL',
    total_bacteria_count: 'CFU/mL',
    tan: 'mg/L',
    water_level: 'm',
    ph_lab: '',
  };
  return units[key] ?? '';
}

export function deriveAlertsFromReading(
  parameters: SensorParameters
): AlertInfo[] {
  const alerts: AlertInfo[] = [];
  for (const [key, value] of Object.entries(parameters)) {
    if (value === null || value === undefined || typeof value !== 'number') continue;
    const status = checkParameterStatus(key, value);
    if (status === 'critical') {
      const threshold = DEFAULT_THRESHOLDS[key];
      alerts.push({
        parameter: key,
        severity: 'critical',
        currentValue: value,
        threshold: threshold ? (value > threshold.max ? threshold.max : threshold.min) : value,
        message: `${getParameterLabel(key)} out of range`,
      });
    }
  }
  return alerts;
}


