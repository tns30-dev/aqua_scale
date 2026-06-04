import { useMemo } from 'react';
import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { Card } from '../../design-system';
import { generateMinuteForecast } from '../../utils/forecastEngine';
import { getThreshold } from '../../utils/parameterThresholds';
interface MinuteForecastChartProps {
  title: string;
  subtitle: string;
  historicalData: Array<{ time: string; value: number | null }>;
  currentMinuteAverage: number | null;
  unit: string;
  color: string;
  parameterKey: string;
}

interface ChartDatum {
  time: string;
  actual: number | null;
  forecast: number | null;
  upperBound: number | null;
  lowerBound: number | null;
  ciBottom?: number | null;
  ciHeight?: number | null;
}

export function MinuteForecastChart({
  title,
  subtitle,
  historicalData,
  currentMinuteAverage,
  unit,
  color,
  parameterKey,
}: MinuteForecastChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartData: ChartDatum[] = useMemo(() => {
    const historical: ChartDatum[] = historicalData.map((point) => ({
      time: point.time,
      actual: point.value,
      forecast: null,
      upperBound: null,
      lowerBound: null,
      ciBottom: null,
      ciHeight: null,
    }));

    const nowPoint: ChartDatum | null =
      currentMinuteAverage !== null
        ? {
            time: 'Now',
            actual: Number(currentMinuteAverage.toFixed(2)),
            forecast: Number(currentMinuteAverage.toFixed(2)),
            // Narrower CI at 'Now': ±2%
            upperBound: Number((currentMinuteAverage * 1.02).toFixed(2)),
            lowerBound: Number((currentMinuteAverage * 0.98).toFixed(2)),
          }
        : null;

    if (nowPoint) {
      historical.push(nowPoint);
    }

    const validHistorical = historicalData
      .filter((point) => point.value !== null)
      .map((point) => point.value as number);

    if (currentMinuteAverage !== null) {
      validHistorical.push(currentMinuteAverage);
    }

    let forecastPoints: ChartDatum[] = [];
    if (validHistorical.length > 0) {
      const forecast = generateMinuteForecast(validHistorical, 5, new Date());
      forecastPoints = forecast.map((point, index) => ({
        time: `+${index + 1}m`,
        actual: null,
        forecast: point.value,
        upperBound: point.upperBound,
        lowerBound: point.lowerBound,
        ciBottom: point.lowerBound,
        ciHeight: Number((point.upperBound - point.lowerBound).toFixed(2)),
      }));
    }

    return [...historical, ...forecastPoints];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalData, currentMinuteAverage]);

  const renderTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const point = payload[0].payload as ChartDatum;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg min-w-[160px]">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {point.actual !== null && (
          <p className="text-sm text-gray-700 mt-1">
            Actual: <span className="font-semibold">{point.actual}{unit}</span>
          </p>
        )}
        {point.forecast !== null && (
          <div className="mt-1">
            <p className="text-sm text-gray-700">
              Forecast: <span className="font-semibold">{point.forecast}{unit}</span>
            </p>
            {point.upperBound !== null && point.lowerBound !== null && (
              <p className="text-xs text-gray-500">
                95% CI: {point.lowerBound.toFixed(2)} - {point.upperBound.toFixed(2)}
                {unit}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>

      <ResponsiveContainer width="100%" height={300} onResize={(w) => setChartWidth(w)}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`confidenceGradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="50%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 12 }} interval={chartWidth >= 520 ? 0 : undefined}/>
          <YAxis
            stroke="#666"
            tick={{ fontSize: 12 }}
            domain={() => {
              const vals: number[] = [];
              chartData.forEach((p) => {
                if (p.actual !== null) vals.push(p.actual);
                if (p.forecast !== null) vals.push(p.forecast);
                if (p.upperBound !== null) vals.push(p.upperBound);
                if (p.lowerBound !== null) vals.push(p.lowerBound);
              });
              if (vals.length === 0) return [0, 10];
              const vmin = Math.min(...vals);
              const vmax = Math.max(...vals);
              const pad = (vmax - vmin || 1) * 0.1;
              return [Math.floor(vmin - pad), Math.ceil(vmax + pad)];
            }}
            label={{
              value: unit,
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12 },
            }}
          />
          <Tooltip content={renderTooltip} />
          <Legend />

          {/* Threshold Boundary Lines */}
          {(() => {
            const thr = getThreshold(parameterKey);
            if (!thr) return null;
            return (
              <>
                <ReferenceLine
                  y={thr.max}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: `Max (${thr.max}${unit})`,
                    position: 'right',
                    fill: '#ef4444',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                <ReferenceLine
                  y={thr.min}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: `Min (${thr.min}${unit})`,
                    position: 'right',
                    fill: '#ef4444',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              </>
            );
          })()}

          {/* Smooth Confidence Band */}
          <Area
            type="monotone"
            dataKey="upperBound"
            stroke="none"
            fill={`url(#confidenceGradient-${title.replace(/\s+/g, '-')})`}
            fillOpacity={1}
            name=""
            legendType="none"
            isAnimationActive={false}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="lowerBound"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
            name=""
            legendType="none"
            isAnimationActive={false}
            connectNulls
          />

          <Line
            type="monotone"
            dataKey="actual"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            name="Actual"
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: color, r: 3 }}
            name="Forecast"
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}


