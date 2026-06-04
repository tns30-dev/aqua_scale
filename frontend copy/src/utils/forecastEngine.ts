/**
 * Simple forecasting engine using weighted moving average and linear regression
 * Designed for MVP – can be replaced with real ML models later.
 */

export interface ForecastPoint {
  value: number;
  upperBound: number;
  lowerBound: number;
  timestamp: Date;
}

/**
 * Calculate weighted moving average (recent data weighted more heavily).
 */
function calculateWeightedAverage(data: number[]): number {
  if (data.length === 0) return 0;

  const weights = data.map((_, index) => index + 1);
  const weightedSum = data.reduce((sum, value, index) => sum + value * weights[index], 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return weightedSum / totalWeight;
}

/**
 * Calculate linear trend (slope) using least squares regression.
 */
function calculateLinearTrend(data: number[]): number {
  if (data.length < 2) return 0;

  const n = data.length;
  const xMean = (n - 1) / 2; // average index
  const yMean = data.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (data[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate confidence interval bounds that widen as we project further out.
 */
function calculateConfidenceInterval(
  value: number,
  periodsAhead: number,
  totalPeriods: number,
  baseConfidence: number,
  maxConfidence: number
): { upper: number; lower: number } {
  const confidencePercent =
    baseConfidence + (maxConfidence - baseConfidence) * (periodsAhead / totalPeriods);

  return {
    upper: value * (1 + confidencePercent),
    lower: value * (1 - confidencePercent),
  };
}

/**
 * Generate forecast for hourly data (e.g., Temperature, pH).
 */
export function generateHourlyForecast(
  historicalData: number[],
  periodsAhead: number,
  startTime: Date
): ForecastPoint[] {
  if (historicalData.length === 0) return [];

  const wma = calculateWeightedAverage(historicalData);
  const trend = calculateLinearTrend(historicalData);

  const forecast: ForecastPoint[] = [];

  for (let i = 1; i <= periodsAhead; i += 1) {
    const predicted = wma + trend * i;
    const variation = predicted * (Math.random() * 0.04 - 0.02); // ±2%
    const value = predicted + variation;

    // Narrower CI: 3% → 6% over forecast horizon
    const bounds = calculateConfidenceInterval(value, i, periodsAhead, 0.03, 0.06);
    const timestamp = new Date(startTime.getTime() + i * 60 * 60 * 1000);

    forecast.push({
      value: Number(value.toFixed(2)),
      upperBound: Number(bounds.upper.toFixed(2)),
      lowerBound: Number(bounds.lower.toFixed(2)),
      timestamp,
    });
  }

  return forecast;
}

/**
 * Generate forecast for minute data (e.g., Dissolved Oxygen).
 */
export function generateMinuteForecast(
  historicalData: number[],
  periodsAhead: number,
  startTime: Date
): ForecastPoint[] {
  if (historicalData.length === 0) return [];

  const wma = calculateWeightedAverage(historicalData);
  const trend = calculateLinearTrend(historicalData);

  const forecast: ForecastPoint[] = [];

  for (let i = 1; i <= periodsAhead; i += 1) {
    const predicted = wma + trend * i;
    const variation = predicted * (Math.random() * 0.03 - 0.015); // ±1.5%
    const value = predicted + variation;

    // Narrower CI for minute-level: 2% → 5%
    const bounds = calculateConfidenceInterval(value, i, periodsAhead, 0.02, 0.05);
    const timestamp = new Date(startTime.getTime() + i * 60 * 1000);

    forecast.push({
      value: Number(value.toFixed(2)),
      upperBound: Number(bounds.upper.toFixed(2)),
      lowerBound: Number(bounds.lower.toFixed(2)),
      timestamp,
    });
  }

  return forecast;
}

/**
 * Aggregate WebSocket readings into hourly averages (for charts/historical context).
 */
export function aggregateToHourly(readings: Array<{ timestamp: Date; value: number }>): number[] {
  if (readings.length === 0) return [];

  const hourlyGroups = new Map<string, number[]>();

  readings.forEach((reading) => {
    const hourKey = `${reading.timestamp.getFullYear()}-${reading.timestamp.getMonth()}-${reading.timestamp.getDate()}-${reading.timestamp.getHours()}`;
    if (!hourlyGroups.has(hourKey)) {
      hourlyGroups.set(hourKey, []);
    }
    hourlyGroups.get(hourKey)!.push(reading.value);
  });

  const hourlyAverages: number[] = [];
  hourlyGroups.forEach((values) => {
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    hourlyAverages.push(avg);
  });

  return hourlyAverages;
}

/**
 * Aggregate WebSocket readings into minute averages (for high-frequency metrics).
 */
export function aggregateToMinute(readings: Array<{ timestamp: Date; value: number }>): number[] {
  if (readings.length === 0) return [];

  const minuteGroups = new Map<string, number[]>();

  readings.forEach((reading) => {
    const minuteKey = `${reading.timestamp.getFullYear()}-${reading.timestamp.getMonth()}-${reading.timestamp.getDate()}-${reading.timestamp.getHours()}-${reading.timestamp.getMinutes()}`;
    if (!minuteGroups.has(minuteKey)) {
      minuteGroups.set(minuteKey, []);
    }
    minuteGroups.get(minuteKey)!.push(reading.value);
  });

  const minuteAverages: number[] = [];
  minuteGroups.forEach((values) => {
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    minuteAverages.push(avg);
  });

  return minuteAverages;
}


