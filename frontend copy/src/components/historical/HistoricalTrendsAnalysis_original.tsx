import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { getProfileColors } from '../../utils/profileColors';
import { apiService } from '../../services/api.service';
import type { Pond } from '../../types';

interface HistoricalTrendsAnalysisProps {
  ponds: Pond[];
  selectedPondId: string;
  onPondChange: (pondId: string) => void;
  projectId: string;
  profileType?: string;
}

export function HistoricalTrendsAnalysis({ 
  ponds, 
  selectedPondId, 
  onPondChange,
  projectId,
  profileType = 'shrimp' 
}: HistoricalTrendsAnalysisProps) {
  const [selectedParameter, setSelectedParameter] = useState('temperature');
  const [timeRange, setTimeRange] = useState('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real data from backend
  const [chartData, setChartData] = useState<{
    multiParameterTrends: any[];
    correlationHeatmap: {
      parameters: string[];
      parameterLabels: { [key: string]: string };
      matrix: number[][];
    } | null;
    historicalTrends: any[];
  }>({
    multiParameterTrends: [],
    correlationHeatmap: null,
    historicalTrends: []
  });
  
  const colors = getProfileColors(profileType);

  // Calculate days for custom range
  const calculateDaysBetween = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Fetch chart data from backend
  useEffect(() => {
    const fetchChartData = async () => {
      if (!selectedPondId || !projectId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Calculate time range
        const days = timeRange === 'custom' && customStartDate && customEndDate
          ? calculateDaysBetween(customStartDate, customEndDate)
          : parseInt(timeRange);
        
        // Fetch real data from backend
        const data = await apiService.getHistoricalCharts(
          selectedPondId,
          projectId,
          days
        );
        
        setChartData(data);
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError('Failed to load chart data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChartData();
  }, [selectedPondId, projectId, timeRange, customStartDate, customEndDate]);

  // Custom tooltip for Multi-Parameter Trends chart
  const CustomMultiParameterTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  // Custom tooltip for Historical Trends chart
  const CustomHistoricalTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '12px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  // Color scale function for correlation heatmap
  const getCorrelationColor = (value: number): string => {
    if (value >= 0.8) return '#991B1B';      // Dark red
    if (value >= 0.6) return '#DC2626';      // Red
    if (value >= 0.4) return '#F87171';      // Light red
    if (value >= 0.2) return '#FCA5A5';      // Very light red
    if (value >= -0.2) return '#E5E7EB';     // Gray
    if (value >= -0.4) return '#BFDBFE';     // Very light blue
    if (value >= -0.6) return '#60A5FA';     // Light blue
    if (value >= -0.8) return '#2563EB';     // Blue
    return '#1E3A8A';                         // Dark blue
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" 
               style={{ borderColor: colors.primary }}></div>
          <div className="text-gray-600">Loading chart data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️ {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: colors.primary }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          {/* Pond Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pond Selection
            </label>
            <select 
              value={selectedPondId}
              onChange={(e) => onPondChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
            >
              {ponds.map(pond => (
                <option key={pond.pond_id} value={pond.pond_id}>
                  {pond.name}
                </option>
              ))}
            </select>
          </div>

          {/* Parameter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parameter
            </label>
            <select 
              value={selectedParameter}
              onChange={(e) => setSelectedParameter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
            >
              <option value="temperature">Temperature</option>
              <option value="salinity">Salinity</option>
              <option value="ph">pH</option>
              <option value="ammonia">Ammonia</option>
              <option value="nitrate">Nitrate</option>
              <option value="alkalinity">Alkalinity</option>
            </select>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
            >
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Custom Date Range (conditional) */}
          {timeRange === 'custom' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Date Range
              </label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
                  placeholder="Start Date"
                />
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
                  placeholder="End Date"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Parameter Trends Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Multi-Parameter Trends
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {timeRange === 'custom' ? 'Custom range' : `${timeRange}-day`} historical comparison
        </p>

        {chartData.multiParameterTrends.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData.multiParameterTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                stroke="#9CA3AF"
              />
              
              <YAxis 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                stroke="#9CA3AF"
              />
              
              <Tooltip content={<CustomMultiParameterTooltip />} />
              
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              {/* Temperature Line */}
              <Line 
                type="monotone" 
                dataKey="temperature" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4 }}
                name="Temperature (°C)"
                activeDot={{ r: 6 }}
              />
              
              {/* pH Line */}
              <Line 
                type="monotone" 
                dataKey="ph" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 4 }}
                name="pH Level"
                activeDot={{ r: 6 }}
              />
              
              {/* Salinity Line */}
              <Line 
                type="monotone" 
                dataKey="salinity" 
                stroke="#F59E0B" 
                strokeWidth={2}
                dot={{ fill: '#F59E0B', r: 4 }}
                name="Salinity (ppt)"
                activeDot={{ r: 6 }}
              />
              
              {/* Ammonia Line */}
              <Line 
                type="monotone" 
                dataKey="ammonia" 
                stroke={colors.primary} 
                strokeWidth={2}
                dot={{ fill: colors.primary, r: 4 }}
                name="Ammonia (mg/L)"
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No data available for selected time range
          </div>
        )}
      </div>

      {/* Charts Section - SIDE BY SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: Correlation Heatmap */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Parameter Correlations
          </h3>

          {chartData.correlationHeatmap && chartData.correlationHeatmap.parameters.length > 0 ? (
            <div className="flex gap-4">
              {/* Heatmap Grid */}
              <div className="flex-1 overflow-x-auto">
                <div className="inline-grid" style={{ gridTemplateColumns: `auto repeat(${chartData.correlationHeatmap.parameters.length}, 45px)`, gap: 0 }}>
                  {/* Empty corner */}
                  <div></div>
                  
                  {/* Column headers with SLANTED labels */}
                  {chartData.correlationHeatmap.parameters.map((param, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-end justify-start pb-1"
                      style={{ height: '80px', width: '45px' }}
                    >
                      <span 
                        className="text-gray-600 font-medium"
                        style={{ 
                          transform: 'rotate(-45deg)',
                          transformOrigin: 'bottom left',
                          whiteSpace: 'nowrap',
                          marginLeft: '5px',
                          fontSize: '10px'
                        }}
                      >
                        {chartData.correlationHeatmap.parameterLabels[param] || param}
                      </span>
                    </div>
                  ))}
                  
                  {/* Data rows */}
                  {chartData.correlationHeatmap.matrix.map((row, rowIdx) => (
                    <>
                      {/* Row label */}
                      <div 
                        key={`label-${rowIdx}`}
                        className="text-gray-600 p-1 text-right font-medium flex items-center justify-end whitespace-nowrap"
                        style={{ fontSize: '10px' }}
                      >
                        {chartData.correlationHeatmap!.parameterLabels[chartData.correlationHeatmap!.parameters[rowIdx]] || chartData.correlationHeatmap!.parameters[rowIdx]}
                      </div>
                      
                      {/* Correlation cells */}
                      {row.map((value, colIdx) => (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className="flex items-center justify-center font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ 
                            backgroundColor: getCorrelationColor(value),
                            color: Math.abs(value) > 0.5 ? 'white' : '#374151',
                            width: '45px',
                            height: '45px',
                            fontSize: '11px',
                            margin: 0,
                            padding: 0
                          }}
                          title={`${chartData.correlationHeatmap!.parameters[rowIdx]} vs ${chartData.correlationHeatmap!.parameters[colIdx]}: ${value.toFixed(2)}`}
                        >
                          {value.toFixed(1)}
                        </div>
                      ))}
                    </>
                  ))}
                </div>
              </div>

              {/* Color Scale Legend */}
              <div className="w-20 flex-shrink-0">
                <div className="text-xs font-medium text-gray-700 mb-2">Scale</div>
                <div className="flex flex-col gap-0.5">
                  {[1.0, 0.8, 0.6, 0.4, 0.2, 0.0, -0.2, -0.4, -0.6, -0.8].map((val) => (
                    <div key={val} className="flex items-center gap-1.5">
                      <div 
                        className="w-6 h-3 rounded"
                        style={{ backgroundColor: getCorrelationColor(val) }}
                      />
                      <span className="text-xs text-gray-600 w-8">{val.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No correlation data available
            </div>
          )}
        </div>

        {/* RIGHT: Historical Trends Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Historical Trends of Key Parameters
          </h3>

          {chartData.historicalTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData.historicalTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  stroke="#9CA3AF"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  stroke="#9CA3AF"
                  label={{ 
                    value: 'Value', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#6B7280' }
                  }}
                />
                
                <Tooltip content={<CustomHistoricalTooltip />} />
                
                {/* LEGEND AT BOTTOM */}
                <Legend 
                  verticalAlign="bottom"
                  height={40}
                  iconType="line"
                  wrapperStyle={{ 
                    paddingTop: '20px',
                    fontSize: '11px'
                  }}
                />
                
                <Line 
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  name="Temperature (°C)"
                  dot={false}
                />
                
                <Line 
                  type="monotone" 
                  dataKey="salinity" 
                  stroke={colors.primary} 
                  strokeWidth={2}
                  name="Salinity (ppt)"
                  dot={false}
                />
                
                <Line 
                  type="monotone" 
                  dataKey="ph" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="pH"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No historical trends data available
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export function HistoricalTrendsAnalysis({ ponds, selectedPondId, onPondChange }: HistoricalTrendsAnalysisProps) {
  const [selectedParameter, setSelectedParameter] = useState('temperature');
  const [timeRange, setTimeRange] = useState('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const colors = getProfileColors('shrimp');

  // Custom tooltip for Multi-Parameter Trends chart
  const CustomMultiParameterTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  // Custom tooltip for Historical Trends chart
  const CustomHistoricalTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '12px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ fontSize: '12px', color: entry.color, margin: '4px 0' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  // Generate mock trends data
  const mockTrendsData = useMemo(() => {
    const days = timeRange === 'custom' ? 30 : parseInt(timeRange);
    return Array.from({ length: days }, (_, i) => ({
      day: `Day ${(i + 1) * (90 / days)}`,
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      temperature: 26 + Math.random() * 4,
      ph: 7.2 + Math.random() * 0.8,
      oxygen: 5.5 + Math.random() * 1.5,
      salinity: 14 + Math.random() * 2,
      ammonium: 0.1 + Math.random() * 0.3,
      turbidity: 20 + Math.random() * 15
    }));
  }, [timeRange]);

  // Correlation matrix data (7x7)
  const correlationMatrix = [
    [1.0, -0.8, 0.2, 0.3, 0.1, 0.4, -0.2],  // Temperature
    [-0.8, 1.0, -0.1, -0.3, 0.0, -0.5, 0.3], // Dissolved Oxygen
    [0.2, -0.1, 1.0, 0.6, 0.4, 0.2, -0.1],   // pH
    [0.3, -0.3, 0.6, 1.0, 0.3, 0.7, 0.4],    // Ammonium
    [0.1, 0.0, 0.4, 0.3, 1.0, 0.2, 0.1],     // Salinity
    [0.4, -0.5, 0.2, 0.7, 0.2, 1.0, 0.5],    // Vibrio Count
    [-0.2, 0.3, -0.1, 0.4, 0.1, 0.5, 1.0]    // Turbidity
  ];

  const parameters = [
    'Temperature (°C)',
    'Dissolved Oxygen (mg/L)',
    'pH',
    'Ammonium (mg/L)',
    'Salinity (ppt)',
    'Vibrio Count (CFU/mL)',
    'Turbidity (NTU)'
  ];

  // Color scale function for heatmap
  const getCorrelationColor = (value: number) => {
    if (value >= 0.8) return '#991B1B'; // Dark red
    if (value >= 0.6) return '#DC2626'; // Red
    if (value >= 0.4) return '#F87171'; // Light red
    if (value >= 0.2) return '#FCA5A5'; // Very light red
    if (value >= -0.2) return '#E5E7EB'; // Gray
    if (value >= -0.4) return '#BFDBFE'; // Very light blue
    if (value >= -0.6) return '#60A5FA'; // Light blue
    if (value >= -0.8) return '#2563EB'; // Blue
    return '#1E3A8A'; // Dark blue
  };

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          {/* Pond Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pond Selection
            </label>
            <select 
              value={selectedPondId}
              onChange={(e) => onPondChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
            >
              {ponds.map(pond => (
                <option key={pond.pond_id} value={pond.pond_id}>
                  {pond.name}
                </option>
              ))}
            </select>
          </div>

          {/* Parameter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parameter
            </label>
            <select 
              value={selectedParameter}
              onChange={(e) => setSelectedParameter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
            >
              <option value="temperature">Temperature</option>
              <option value="dissolvedOxygen">Dissolved Oxygen</option>
              <option value="ph">pH</option>
              <option value="salinity">Salinity</option>
              <option value="ammonium">Ammonium</option>
              <option value="turbidity">Turbidity</option>
            </select>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
            >
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Custom Date Range (conditional) */}
          {timeRange === 'custom' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Date Range
              </label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
                  placeholder="Start Date"
                />
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all"
                  placeholder="End Date"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Parameter Trends Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Multi-Parameter Trends
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {timeRange === 'custom' ? 'Custom' : timeRange}-day historical comparison
        </p>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mockTrendsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              stroke="#9CA3AF"
            />
            
            <YAxis 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              stroke="#9CA3AF"
            />
            
            <Tooltip content={<CustomMultiParameterTooltip />} />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            
            {/* Temperature Line */}
            <Line 
              type="monotone" 
              dataKey="temperature" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 4 }}
              name="Temperature (°C)"
              activeDot={{ r: 6 }}
            />
            
            {/* pH Line */}
            <Line 
              type="monotone" 
              dataKey="ph" 
              stroke="#c117c1aa" 
              strokeWidth={2}
              dot={{ fill: '#c117c1aa', r: 4 }}
              name="pH Level"
              activeDot={{ r: 6 }}
            />
            
            {/* Dissolved Oxygen Line */}
            <Line 
              type="monotone" 
              dataKey="oxygen" 
              stroke={colors.primary} 
              strokeWidth={2}
              dot={{ fill: colors.primary, r: 4 }}
              name="Oxygen (mg/L)"
              activeDot={{ r: 6 }}
            />
            
            {/* Salinity Line */}
            <Line 
              type="monotone" 
              dataKey="salinity" 
              stroke="#F59E0B" 
              strokeWidth={2}
              dot={{ fill: '#F59E0B', r: 4 }}
              name="Salinity (ppt)"
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Section - SIDE BY SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: Correlation Heatmap - COMPACT */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Parameter Correlations
          </h3>

          <div className="flex gap-4">
            {/* Heatmap - COMPACT, NO GAPS */}
            <div className="flex-1 overflow-x-auto">
              <div className="inline-grid" style={{ gridTemplateColumns: `auto repeat(7, 45px)`, gap: 0 }}>
                {/* Header row with SLANTED labels */}
                <div></div>
                {parameters.map((param, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-end justify-start pb-1"
                    style={{ height: '80px', width: '45px' }}
                  >
                    <span 
                      className="text-gray-600 font-medium"
                      style={{ 
                        transform: 'rotate(-45deg)',
                        transformOrigin: 'bottom left',
                        whiteSpace: 'nowrap',
                        marginLeft: '5px',
                        fontSize: '10px'
                      }}
                    >
                      {param}
                    </span>
                  </div>
                ))}
                
                {/* Data rows */}
                {correlationMatrix.map((row, rowIdx) => (
                  <>
                    {/* Row label - SMALLER */}
                    <div 
                      key={`label-${rowIdx}`}
                      className="text-gray-600 p-1 text-right font-medium flex items-center justify-end whitespace-nowrap"
                      style={{ fontSize: '10px' }}
                    >
                      {parameters[rowIdx]}
                    </div>
                    
                    {/* Correlation cells - NO GAPS */}
                    {row.map((value, colIdx) => (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className="flex items-center justify-center font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ 
                          backgroundColor: getCorrelationColor(value),
                          color: Math.abs(value) > 0.5 ? 'white' : '#374151',
                          width: '45px',
                          height: '45px',
                          fontSize: '11px',
                          margin: 0,
                          padding: 0
                        }}
                        title={`${parameters[rowIdx]} vs ${parameters[colIdx]}: ${value.toFixed(2)}`}
                      >
                        {value.toFixed(1)}
                      </div>
                    ))}
                  </>
                ))}
              </div>
            </div>

            {/* Color Scale Legend - COMPACT */}
            <div className="w-20 flex-shrink-0">
              <div className="text-xs font-medium text-gray-700 mb-2">Scale</div>
              <div className="flex flex-col gap-0.5">
                {[1.0, 0.8, 0.6, 0.4, 0.2, 0.0, -0.2, -0.4, -0.6, -0.8].map((val) => (
                  <div key={val} className="flex items-center gap-1.5">
                    <div 
                      className="w-6 h-3 rounded"
                      style={{ backgroundColor: getCorrelationColor(val) }}
                    />
                    <span className="text-xs text-gray-600 w-8">{val.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Historical Trends Chart - LEGEND AT BOTTOM */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Historical Trends of Key Parameters
          </h3>

          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={mockTrendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: '#6B7280' }}
                stroke="#9CA3AF"
                angle={-45}
                textAnchor="end"
                height={70}
              />
              
              <YAxis 
                tick={{ fontSize: 11, fill: '#6B7280' }}
                stroke="#9CA3AF"
                label={{ 
                  value: 'Value', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: '#6B7280' }
                }}
              />
              
              <Tooltip content={<CustomHistoricalTooltip />} />
              
              {/* LEGEND AT BOTTOM - HORIZONTAL */}
              <Legend 
                verticalAlign="bottom"
                height={40}
                iconType="line"
                wrapperStyle={{ 
                  paddingTop: '20px',
                  fontSize: '11px'
                }}
              />
              
              <Line 
                type="monotone" 
                dataKey="temperature" 
                stroke="#F59E0B" 
                strokeWidth={2}
                name="Temperature (°C)"
                dot={false}
              />
              
              <Line 
                type="monotone" 
                dataKey="oxygen" 
                stroke={colors.primary} 
                strokeWidth={2}
                name="DO (mg/L)"
                dot={false}
              />
              
              <Line 
                type="monotone" 
                dataKey="salinity" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Salinity (ppt)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
