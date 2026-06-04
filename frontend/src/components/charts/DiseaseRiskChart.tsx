import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface DiseaseRiskChartProps {
  data: Record<string, string | number | null>[];
  colors?: {
    primary: string;
    accent: string;
  };
}

export const DiseaseRiskChart = React.memo(function DiseaseRiskChart({ data }: DiseaseRiskChartProps) {
  // Validate data before rendering
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No data available for disease risk analysis
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
        minWidth: '200px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {new Date(label as string).toLocaleDateString()}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              {String(entry.name || '').includes('Risk') ? '' : '%'}
            </span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400} key={`disease-risk-${data.length}`}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        
        {/* Left Y-Axis: Stress Metrics (0-100%) */}
        <YAxis 
          yAxisId="left"
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          domain={[0, 100]}
          label={{ value: 'Stress Level (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
        />
        
        {/* Right Y-Axis: Overall Risk (0-100) */}
        <YAxis 
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#6B7280' }} 
          stroke="#9CA3AF"
          domain={[0, 100]}
          label={{ value: 'Risk Index', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
        />
        
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
          iconType="line"
        />
        
        {/* High Risk Threshold Line */}
        <ReferenceLine 
          y={70} 
          yAxisId="right"
          stroke="#DC2626" 
          strokeDasharray="5 5"
          strokeWidth={2}
          label={{ 
            value: 'High Risk', 
            position: 'right', 
            fill: '#DC2626',
            fontSize: 11,
            fontWeight: 600
          }} 
        />
        
        {/* Bacterial Load - Red Bars (left axis) */}
        <Bar 
          dataKey="bacterialLoad" 
          fill="#EF4444" 
          fillOpacity={0.6}
          yAxisId="left"
          name="Bacterial Load (%)"
        />
        
        {/* Toxicity Stress - Orange Line (left axis) */}
        <Line 
          type="monotone"
          dataKey="toxicityStress" 
          stroke="#F59E0B" 
          strokeWidth={2}
          dot={{ r: 3 }}
          yAxisId="left"
          name="Toxicity Stress (%)"
        />
        
        {/* Environmental Stress - Green Line (left axis) */}
        <Line 
          type="monotone"
          dataKey="environmentalStress" 
          stroke="#10B981" 
          strokeWidth={2}
          dot={{ r: 3 }}
          yAxisId="left"
          name="Environmental Stress (%)"
        />
        
        {/* Overall Risk - Purple Thick Line (right axis) */}
        <Line 
          type="monotone"
          dataKey="overallRisk" 
          stroke="#8B5CF6" 
          strokeWidth={3}
          dot={{ r: 4 }}
          yAxisId="right"
          name="Overall Risk"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
