import type { SensorReading, AlertInfo } from '../types';

export type PondStatus = 'healthy' | 'warning' | 'critical' | 'no_reading';

/**
 * Calculate pond status based on ALL parameter alerts
 * - 0 alerts = healthy
 * - 1-2 alerts = warning  
 * - 3+ alerts = critical
 */
export function calculatePondStatus(reading: SensorReading | undefined): PondStatus {
  if (!reading) return 'no_reading';
  if (!reading.alerts) return 'healthy';
  
  const alertCount = reading.alerts.length;
  
  if (alertCount === 0) return 'healthy';
  if (alertCount <= 2) return 'warning';
  return 'critical';
}

/**
 * Get critical/warning alerts for display in tooltip
 * Returns alerts sorted by severity (critical first)
 */
export function getAlertsForTooltip(reading: SensorReading | undefined): AlertInfo[] {
  if (!reading || !reading.alerts) return [];
  
  return reading.alerts
    .sort((a, b) => {
      // Critical alerts first
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return 0;
    });
}

export interface TooltipParameter {
  key: string;
  value: number;
  isKey: boolean;
  alert?: AlertInfo;
}

/**
 * Get key parameters (always shown) + any additional out-of-range parameters
 */
export function getTooltipParameters(reading: SensorReading | undefined): TooltipParameter[] {
  if (!reading?.parameters) return [];

  const keyParams = ['temperature', 'ph', 'salinity'];
  const params = reading.parameters;
  
  // Always include key parameters
  const result: TooltipParameter[] = keyParams
    .filter(key => params[key as keyof typeof params] !== undefined && params[key as keyof typeof params] !== null)
    .map(key => ({
      key,
      value: params[key as keyof typeof params] as number,
      isKey: true,
    }));

  // Add any OTHER parameters that have alerts
  if (reading.alerts && reading.alerts.length > 0) {
    reading.alerts.forEach(alert => {
      // If alert parameter is NOT one of the key 3, add it
      if (!keyParams.includes(alert.parameter)) {
        const value = params[alert.parameter as keyof typeof params];
        if (value !== undefined && value !== null) {
          // Check if already added
          const alreadyAdded = result.some(p => p.key === alert.parameter);
          if (!alreadyAdded) {
            result.push({
              key: alert.parameter,
              value: value as number,
              isKey: false,
              alert: alert,
            });
          }
        }
      }
    });
  }

  return result;
}

