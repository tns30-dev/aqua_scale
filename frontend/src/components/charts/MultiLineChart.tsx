import React from 'react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface MultiLineChartProps {
  data: Record<string, string | number | null>[];
  parameters: string[];
  title?: string;
  colors?: {
    primary: string;
    accent: string;
  };
}

export const MultiLineChart = React.memo(function MultiLineChart({ data, parameters, colors }: MultiLineChartProps) {
  // Validate data before rendering
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No data available for this chart
      </div>
    );
  }

  // Validate parameters
  if (!parameters || parameters.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No parameters specified
      </div>
    );
  }

  // Define colors for each parameter
  const parameterColors: Record<string, string> = {
    ammonia: '#EF4444',      // Red - most toxic
    nitrite: '#F59E0B',      // Orange - toxic
    nitrate: '#10B981',      // Green - less toxic
    phosphate: '#3B82F6',    // Blue - nutrient (phosphorus)
  };

  // Parameter labels with units
  const parameterLabels: Record<string, string> = {
    ammonia: 'Ammonia (mg/L)',
    nitrite: 'Nitrite (mg/L)',
    nitrate: 'Nitrate (mg/L)',
    phosphate: 'Phosphorus (mg/L)', // Display as "Phosphorus" for aquaculture
  };

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
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value} mg/L
            </span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={350} key={`multi-${data.length}-${parameters.join('-')}`}>
      <ComposedChart data={data}>
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
          label={{ value: 'mg/L', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
        
        {/* Render each parameter as a separate Area WITHOUT stackId for overlapping */}
        {parameters.map((param) => (
          <Area
            key={param}
            type="monotone"
            dataKey={param}
            name={parameterLabels[param] || param}
            stroke={parameterColors[param] || colors?.primary || '#3B82F6'}
            fill={parameterColors[param] || colors?.primary || '#3B82F6'}
            fillOpacity={0.3}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
});
