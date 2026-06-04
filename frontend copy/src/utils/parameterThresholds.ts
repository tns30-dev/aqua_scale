export const PARAMETER_THRESHOLDS = {
  temperature: { min: 26, max: 31, unit: '°C' },
  ph: { min: 7.0, max: 8.5, unit: '' },
  dissolved_oxygen: { min: 5, max: 10, unit: 'mg/L' },
  salinity: { min: 15, max: 25, unit: 'ppt' },
  turbidity: { min: 0, max: 15, unit: 'NTU' },
  ammonia: { min: 0, max: 0.5, unit: 'mg/L' },
  nitrate: { min: 0, max: 20, unit: 'mg/L' },
  nitrite: { min: 0, max: 0.5, unit: 'mg/L' },
} as const;

export function getThreshold(parameterKey: string): { min: number; max: number; unit: string } | null {
  return (PARAMETER_THRESHOLDS as any)[parameterKey] || null;
}


