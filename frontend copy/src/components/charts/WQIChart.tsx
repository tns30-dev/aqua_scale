import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface WQIChartProps {
  data: Record<string, string | number | null>[];
  colors?: {
    primary: string;
    accent: string;
  };
}

export const WQIChart = React.memo(function WQIChart({ data }: WQIChartProps) {
  // Validate data before rendering
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No data available for Water Quality Index
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '220px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {new Date(label as string).toLocaleDateString()}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400} key={`wqi-${data.length}`}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        
        {/* Left Y-Axis: Parameters (0-150) */}
        <YAxis 
          yAxisId="left"
          domain={[0, 150]}
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          label={{ value: 'Parameters', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
        />
        
        {/* Right Y-Axis: WQI Score (0-100) */}
        <YAxis 
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          label={{ value: 'WQI Score', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
        />
        
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
          iconType="line"
        />
        
        {/* WQI Threshold Lines (right axis) */}
        <ReferenceLine 
          y={60} 
          yAxisId="right"
          stroke="#F59E0B" 
          strokeDasharray="3 3"
          strokeWidth={1}
          label={{ 
            value: 'Poor', 
            position: 'right', 
            fill: '#F59E0B',
            fontSize: 10
          }}
        />
        <ReferenceLine 
          y={80} 
          yAxisId="right"
          stroke="#10B981" 
          strokeDasharray="3 3"
          strokeWidth={1}
          label={{ 
            value: 'Good', 
            position: 'right', 
            fill: '#10B981',
            fontSize: 10
          }}
        />
        
        {/* Algae Bloom - Green Bars (left axis) */}
        <Bar 
          dataKey="algaeBloom" 
          fill="#10B981" 
          fillOpacity={0.5}
          yAxisId="left"
          name="Algae Bloom (%)"
        />
        
        {/* Water Clarity - Blue Line (left axis) */}
        <Line 
          type="monotone"
          dataKey="clarity" 
          stroke="#3B82F6" 
          strokeWidth={2}
          dot={{ r: 3 }}
          yAxisId="left"
          name="Clarity (cm)"
        />
        
        {/* Hardness - Red Line (left axis) */}
        <Line 
          type="monotone"
          dataKey="hardness" 
          stroke="#EF4444" 
          strokeWidth={2}
          dot={{ r: 3 }}
          yAxisId="left"
          name="Hardness (mg/L)"
        />
        
        {/* Alkalinity - Teal Line (left axis) */}
        <Line 
          type="monotone"
          dataKey="alkalinity" 
          stroke="#14B8A6" 
          strokeWidth={2}
          dot={{ r: 3 }}
          yAxisId="left"
          name="Alkalinity (mg/L)"
        />
        
        {/* WQI - Purple Thick Line (right axis) */}
        <Line 
          type="monotone"
          dataKey="wqi" 
          stroke="#8B5CF6" 
          strokeWidth={3}
          dot={{ r: 4 }}
          yAxisId="right"
          name="WQI Score"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
