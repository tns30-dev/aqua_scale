/**
 * Generate complete time-series data for real-time & forecast charts
 * with no gaps or null values
 * 
 * This ensures continuous visualization without data gaps in the charts.
 */

interface ChartDataPoint {
  time: string;
  value: number | null;
}

interface ParameterConfig {
  baseValue: number;
  variance: number;
  trendSlope: number;
  minValue: number;
  maxValue: number;
}

const parameterConfigs: Record<string, ParameterConfig> = {
  temperature: {
    baseValue: 28,
    variance: 2,
    trendSlope: 0.05,
    minValue: 20,
    maxValue: 35
  },
  dissolved_oxygen: {
    baseValue: 7.5,
    variance: 1.0,
    trendSlope: -0.02,
    minValue: 5,
    maxValue: 10
  },
  ph: {
    baseValue: 7.8,
    variance: 0.3,
    trendSlope: 0.01,
    minValue: 6.5,
    maxValue: 8.5
  },
  salinity: {
    baseValue: 15,
    variance: 1.5,
    trendSlope: 0.02,
    minValue: 10,
    maxValue: 20
  },
  ammonium: {
    baseValue: 0.2,
    variance: 0.1,
    trendSlope: 0.005,
    minValue: 0,
    maxValue: 1
  },
  turbidity: {
    baseValue: 25,
    variance: 5,
    trendSlope: -0.1,
    minValue: 0,
    maxValue: 50
  }
};

/**
 * Generate realistic value with slight randomness and natural variation
 */
function generateValue(
  baseValue: number,
  variance: number,
  timeIndex: number,
  trendSlope: number,
  minValue: number,
  maxValue: number,
  seed: number = 0
): number {
  // Linear trend
  const trend = timeIndex * trendSlope;
  
  // Random variation (using seed for reproducibility)
  const random = Math.sin(seed + timeIndex * 0.5) * 0.5 + 0.5; // 0 to 1
  const randomness = (random - 0.5) * variance;
  
  // Natural sine wave pattern (daily/hourly cycles)
  const sinWave = Math.sin(timeIndex / 3) * (variance * 0.3);
  
  // Combine all factors
  let value = baseValue + trend + randomness + sinWave;
  
  // Clamp to realistic bounds
  value = Math.max(minValue, Math.min(maxValue, value));
  
  return Number(value.toFixed(2));
}

/**
 * Generate complete hourly chart data with no gaps
 * 
 * @param parameter - Parameter name (temperature, dissolved_oxygen, ph, etc.)
 * @param historicalHours - Number of hours of historical data (default 8)
 * @returns Complete time-series data array with NO null values
 */
export function generateCompleteHourlyData(
  parameter: string,
  historicalHours: number = 8
): ChartDataPoint[] {
  const config = parameterConfigs[parameter] || parameterConfigs.temperature;
  const data: ChartDataPoint[] = [];
  
  // Use current timestamp as seed for consistency
  const seed = Date.now() / 10000;
  
  // Generate historical data (all actual values, no nulls)
  for (let i = historicalHours; i > 0; i--) {
    const timeLabel = `-${i}h`;
    const value = generateValue(
      config.baseValue,
      config.variance,
      historicalHours - i,
      config.trendSlope,
      config.minValue,
      config.maxValue,
      seed
    );
    
    data.push({
      time: timeLabel,
      value: value
    });
  }
  
  return data;
}

/**
 * Generate complete minute chart data with no gaps
 * 
 * @param parameter - Parameter name (dissolved_oxygen, etc.)
 * @param historicalMinutes - Number of minutes of historical data (default 10)
 * @returns Complete time-series data array with NO null values
 */
export function generateCompleteMinuteData(
  parameter: string,
  historicalMinutes: number = 10
): ChartDataPoint[] {
  const config = parameterConfigs[parameter] || parameterConfigs.dissolved_oxygen;
  const data: ChartDataPoint[] = [];
  
  // Use current timestamp as seed for consistency
  const seed = Date.now() / 10000;
  
  // Generate minute-level data (all actual values, no nulls)
  for (let i = historicalMinutes; i > 0; i--) {
    const timeLabel = `-${i}m`;
    const value = generateValue(
      config.baseValue,
      config.variance * 0.5, // Less variance for minute-level data
      historicalMinutes - i,
      config.trendSlope * 0.1, // Smaller trend for minute-level
      config.minValue,
      config.maxValue,
      seed
    );
    
    data.push({
      time: timeLabel,
      value: value
    });
  }
  
  return data;
}

/**
 * Fill gaps in existing historical data to ensure continuity
 * This is useful when real data has missing time points
 * 
 * @param data - Existing data array with potential null values
 * @param parameter - Parameter name for realistic value generation
 * @returns Data array with no null values
 */
export function fillDataGaps(
  data: Array<{ time: string; value: number | null }>,
  parameter: string
): Array<{ time: string; value: number | null }> {
  if (data.length === 0) return data;
  
  const config = parameterConfigs[parameter] || parameterConfigs.temperature;
  
  // Get all non-null values to calculate average
  const validValues = data.filter(d => d.value !== null).map(d => d.value as number);
  const avgValue = validValues.length > 0 
    ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
    : config.baseValue;
  
  // Fill nulls with interpolated or generated values
  return data.map((point, index) => {
    if (point.value !== null) {
      return point;
    }
    
    // Try to interpolate between surrounding values
    const prevValid = data.slice(0, index).reverse().find(d => d.value !== null);
    const nextValid = data.slice(index + 1).find(d => d.value !== null);
    
    if (prevValid && nextValid) {
      // Linear interpolation
      const prevIndex = data.indexOf(prevValid);
      const nextIndex = data.indexOf(nextValid);
      const ratio = (index - prevIndex) / (nextIndex - prevIndex);
      const interpolated = prevValid.value! + ratio * (nextValid.value! - prevValid.value!);
      return {
        ...point,
        value: Number(interpolated.toFixed(2))
      };
    }
    
    // Fallback: use average with small random variation
    const variation = (Math.random() - 0.5) * config.variance * 0.5;
    return {
      ...point,
      value: Number((avgValue + variation).toFixed(2))
    };
  });
}

/**
 * Generate data for all parameters at once
 */
export function generateAllParameterData() {
  return {
    temperature: generateCompleteHourlyData('temperature', 8),
    dissolved_oxygen: generateCompleteMinuteData('dissolved_oxygen', 10),
    ph: generateCompleteHourlyData('ph', 8),
    salinity: generateCompleteHourlyData('salinity', 8),
    ammonium: generateCompleteHourlyData('ammonium', 8),
    turbidity: generateCompleteHourlyData('turbidity', 8)
  };
}

/**
 * Check if data has any gaps (null values)
 */
export function hasDataGaps(data: Array<{ time: string; value: number | null }>): boolean {
  return data.some(point => point.value === null);
}

/**
 * Get percentage of data completeness
 */
export function getDataCompleteness(data: Array<{ time: string; value: number | null }>): number {
  if (data.length === 0) return 0;
  const nonNullCount = data.filter(point => point.value !== null).length;
  return (nonNullCount / data.length) * 100;
}
