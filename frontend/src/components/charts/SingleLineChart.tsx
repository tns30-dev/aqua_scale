import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface SingleLineChartProps {
  data: Record<string, string | number | null>[];
  parameter: string;
  colors?: {
    primary: string;
    accent: string;
  };
}

export const SingleLineChart = React.memo(function SingleLineChart({ data, parameter, colors }: SingleLineChartProps) {
  // Validate data before rendering
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No data available for this chart
      </div>
    );
  }

  // Validate parameter
  if (!parameter) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No parameter specified
      </div>
    );
  }

  // Parameter labels and units
  const parameterConfig: Record<string, { label: string; unit: string; optimal?: {min: number; max: number} }> = {
    temperature: {
      label: 'Temperature',
      unit: '°C',
      optimal: { min: 20, max: 28 }  // Optimal range for most fish
    },
    dissolved_oxygen: {
      label: 'Dissolved Oxygen',
      unit: 'mg/L',
      optimal: { min: 5, max: 10 }  // Fish need > 5 mg/L
    },
  };

  const config = parameterConfig[parameter] || { label: parameter, unit: '' };

  const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {new Date(label as string).toLocaleDateString()}
        </p>
        <p style={{ fontSize: '12px', color: colors?.primary || '#3B82F6', margin: '4px 0' }}>
          {config.label}: <span style={{ fontWeight: 600 }}>
            {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value} {config.unit}
          </span>
        </p>
        {config.optimal && (
          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Optimal: {config.optimal.min}-{config.optimal.max} {config.unit}
          </p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={350} key={`single-${data.length}-${parameter}`}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          label={{ value: config.unit, angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
        
        {/* Optimal range indicators */}
        {config.optimal && (
          <>
            <ReferenceLine 
              y={config.optimal.min} 
              stroke="#10B981" 
              strokeDasharray="3 3"
              label={{ value: 'Min Optimal', fontSize: 10, fill: '#10B981' }}
            />
            <ReferenceLine 
              y={config.optimal.max} 
              stroke="#10B981" 
              strokeDasharray="3 3"
              label={{ value: 'Max Optimal', fontSize: 10, fill: '#10B981' }}
            />
          </>
        )}
        
        <Line
          type="monotone"
          dataKey={parameter}
          name={`${config.label} (${config.unit})`}
          stroke={colors?.primary || '#3B82F6'}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
