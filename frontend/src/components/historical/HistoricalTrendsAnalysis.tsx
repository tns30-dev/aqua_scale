import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { getProfileColors } from '../../utils/profileColors';
import { apiService } from '../../services/api.service';
import { MultiLineChart } from '../charts/MultiLineChart';
import { SingleLineChart } from '../charts/SingleLineChart';
import { WQIChart } from '../charts/WQIChart';
import { DiseaseRiskChart } from '../charts/DiseaseRiskChart';

interface HistoricalTrendsAnalysisProps {
  selectedPondId: string;
  projectId: string;
  profileType?: string;
}

export function HistoricalTrendsAnalysis({ 
  selectedPondId,
  projectId,
  profileType = 'shrimp' 
}: HistoricalTrendsAnalysisProps) {
  const [timeRange, setTimeRange] = useState('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<string>('daily');
  
  type ChartDataPoint = Record<string, string | number | null>;

  // Real data from backend
  const [chartData, setChartData] = useState<{
    multiParameterTrends: ChartDataPoint[];
    correlationHeatmap: {
      parameters: string[];
      parameterLabels: { [key: string]: string };
      matrix: number[][];
    } | null;
    historicalTrends: ChartDataPoint[];
    nitrogenCycle?: ChartDataPoint[];
    temperatureTrend?: ChartDataPoint[];
    dissolvedOxygen?: ChartDataPoint[];
    diseaseRisk?: ChartDataPoint[];
    waterQualityIndex?: ChartDataPoint[];
  }>({
    multiParameterTrends: [],
    correlationHeatmap: null,
    historicalTrends: [],
    nitrogenCycle: [],
    temperatureTrend: [],
    dissolvedOxygen: [],
    diseaseRisk: [],
    waterQualityIndex: []
  });
  
  // Memoize colors to prevent infinite re-renders
  const colors = useMemo(() => getProfileColors(profileType), [profileType]);

  // Memoize parameter arrays to prevent recreating them on every render
  // For fish profile: only nitrite and nitrate (remove ammonia and phosphate)
  const nitrogenParams = useMemo(() => 
    profileType === 'fish' 
      ? ['nitrite', 'nitrate'] 
      : ['ammonia', 'nitrite', 'nitrate', 'phosphate'], 
    [profileType]
  );
  const tempParam = useMemo(() => 'temperature', []);
  const doParam = useMemo(() => 'dissolved_oxygen', []);

  // Fetch chart data from backend
  useEffect(() => {
    const fetchChartData = async () => {
        if (!selectedPondId || !projectId) return;

        setIsLoading(true);
        setError(null);

        try {
            // ── startDate + endDate ───────────────────────────────
            const today = new Date().toISOString().split('T')[0];

            let startDate: string;
            let endDate: string;
            let days: number;

            if (timeRange === 'custom') {
              if (!customStartDate || !customEndDate) return;
                  startDate = customStartDate;
                  endDate   = customEndDate;
                  days      = calculateDaysBetween(customStartDate, customEndDate);
              } else {
                  const parsedDays = parseInt(timeRange);
                  
                  if (isNaN(parsedDays) || parsedDays <= 0) return;
                  
                  days      = parsedDays;
                  const start = new Date();
                  start.setDate(start.getDate() - days);
                  
                  if (isNaN(start.getTime())) return;
                  
                  startDate = start.toISOString().split('T')[0];
                  endDate   = today;
              }

            // ── Grouping ──────────────────────────────────────────
            const available       = getAvailableGroupings(days);
            const resolvedGrouping = available.includes(grouping)
                ? grouping
                : getDefaultGrouping(days);

            // Auto-update grouping state if current selection invalid
            if (!available.includes(grouping)) {
                setGrouping(resolvedGrouping);
            }

            // ── Fetch chart data ──────────────────────────────────────────
            const data = await apiService.getHistoricalCharts(
                selectedPondId,
                projectId,
                startDate,
                endDate,
                resolvedGrouping,
            );

            // ── Existing logging ──────────────────────────────
            console.log('Chart data received:', {
                multiParameterTrends: data.multiParameterTrends?.length || 0,
                historicalTrends:     data.historicalTrends?.length || 0,
                nitrogenCycle:        data.nitrogenCycle?.length || 0,
                temperatureTrend:     data.temperatureTrend?.length || 0,
                dissolvedOxygen:      data.dissolvedOxygen?.length || 0,
                diseaseRisk:          data.diseaseRisk?.length || 0,
                waterQualityIndex:    data.waterQualityIndex?.length || 0,
                correlationHeatmap:   data.correlationHeatmap?.parameters?.length || 0,
            });

            // ── Existing helpers ──────────────────────────────
            const limitDataPoints = (arr: ChartDataPoint[], max: number = 1000) => {
                if (!arr || arr.length <= max) return arr;
                const step = Math.ceil(arr.length / max);
                return arr.filter((_, index) => index % step === 0);
            };

            const cleanData = (arr: ChartDataPoint[]) => {
                if (!arr || !Array.isArray(arr)) return [];
                return arr.filter(item => item && typeof item === 'object');
            };

            // ── Set chart data ────────────────────────────────
            setChartData({
                multiParameterTrends: limitDataPoints(cleanData(data.multiParameterTrends || [])),
                correlationHeatmap:   data.correlationHeatmap || null,
                historicalTrends:     limitDataPoints(cleanData(data.historicalTrends || [])),
                nitrogenCycle:        limitDataPoints(cleanData(data.nitrogenCycle || [])),
                temperatureTrend:     limitDataPoints(cleanData(data.temperatureTrend || [])),
                dissolvedOxygen:      limitDataPoints(cleanData(data.dissolvedOxygen || [])),
                diseaseRisk:          limitDataPoints(cleanData(data.diseaseRisk || [])),
                waterQualityIndex:    limitDataPoints(cleanData(data.waterQualityIndex || [])),
            });

        } catch (err) {
            console.error('Error fetching chart data:', err);
            setError('Failed to load chart data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    fetchChartData();
  }, [selectedPondId, projectId, timeRange, customStartDate, customEndDate, grouping]);

  const GROUPING_LABELS: Record<string, string> = {
    hourly:  'Hourly',
    daily:   'Daily',
    weekly:  'Weekly',
    monthly: 'Monthly',
  };

  // Calculate days for custom range
  const calculateDaysBetween = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const getCorrelationColor = (value: number): string => {
    if (value >= 0.8) return '#991B1B';
    if (value >= 0.6) return '#DC2626';
    if (value >= 0.4) return '#F87171';
    if (value >= 0.2) return '#FCA5A5';
    if (value >= -0.2) return '#E5E7EB';
    if (value >= -0.4) return '#BFDBFE';
    if (value >= -0.6) return '#60A5FA';
    if (value >= -0.8) return '#2563EB';
    return '#1E3A8A';
  };

  const getAvailableGroupings = (days: number): string[] => {
    if (days <= 1)  return ['hourly'];
    if (days <= 3)  return ['hourly', 'daily'];
    if (days <= 7)  return ['hourly', 'daily'];
    if (days <= 30) return ['daily', 'weekly'];
    if (days <= 90) return ['daily', 'weekly'];
    return ['weekly', 'monthly'];
  };

  const getDefaultGrouping = (days: number): string => {
    if (days <= 3)  return 'hourly';
    if (days <= 90) return 'daily';
    return 'weekly';
  };

  const getDaysFromRange = (): number => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
        return calculateDaysBetween(customStartDate, customEndDate);
    }
    return parseInt(timeRange);
};

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
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Time Range + Grouping Controls */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
              {/* Row 1 — Time Range + Grouping side by side on sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Time Range */}
                  <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                          Time Range
                      </label>
                      <select
                          value={timeRange}
                          onChange={(e) => {
                              setTimeRange(e.target.value);
                              const days = e.target.value === 'custom'
                                  ? getDaysFromRange()
                                  : parseInt(e.target.value);
                              setGrouping(getDefaultGrouping(days));
                          }}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent focus:outline-none bg-white"
                          style={{ borderColor: colors.primary }}
                      >
                          <option value="30">Last 30 Days</option>
                          <option value="60">Last 60 Days</option>
                          <option value="90">Last 90 Days</option>
                          <option value="custom">Custom Range</option>
                      </select>
                  </div>

                  {timeRange === 'custom' && (
                    <div className="xl:col-span-2 min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Custom Date Range
                      </label>

                      {/* Stack on mobile, row on sm+ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => {
                                setCustomStartDate(e.target.value);
                                if (customEndDate) {
                                    const days = calculateDaysBetween(e.target.value, customEndDate);
                                    const available = getAvailableGroupings(days);
                                    if (!available.includes(grouping)) {
                                        setGrouping(getDefaultGrouping(days));
                                    }
                                }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        />
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => {
                                setCustomEndDate(e.target.value);
                                if (customStartDate) {
                                    const days = calculateDaysBetween(customStartDate, e.target.value);
                                    const available = getAvailableGroupings(days);
                                    if (!available.includes(grouping)) {
                                        setGrouping(getDefaultGrouping(days));
                                    }
                                }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Group By */}
                  <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                          Group By
                      </label>
                      <div className="flex gap-2 flex-wrap">
                          {getAvailableGroupings(getDaysFromRange()).map((g) => (
                              <button
                                  key={g}
                                  onClick={() => setGrouping(g)}
                                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all whitespace-nowrap ${
                                    grouping === g
                                          ? 'text-white border-transparent'
                                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                  }`}
                                  style={
                                      grouping === g
                                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                                          : {}
                                  }
                              >
                                  {GROUPING_LABELS[g]}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Multi-Parameter Trends */}
      <div
        className="bg-white rounded-lg border p-4 sm:p-6 min-w-0"
        style={{
          borderColor: `${colors.primary}20`,
          boxShadow: `0 2px 4px ${colors.primary}10`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 min-w-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
              Multi-Parameter Trends
            </h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {timeRange === 'custom' ? 'Custom range' : `${timeRange}-day`} historical comparison
            </p>
          </div>

          <button
            onClick={() => {
              console.log('Export chart data');
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: colors.primary }}
          >
            Export Data
          </button>
        </div>

        {chartData.multiParameterTrends.length > 0 ? (
          <div className="min-w-0">
            <ResponsiveContainer
              width="100%"
              height={320}
              key={`multi-${timeRange}-${chartData.multiParameterTrends.length}`}
            >
              <LineChart data={chartData.multiParameterTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} stroke="#9CA3AF" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />

                {(() => {
                  const colors_chart = ['#3B82F6', '#10B981', '#F59E0B', colors.primary, '#8B5CF6', '#EC4899'];
                  const paramLabels: Record<string, string> = {
                    temperature: 'Temperature (°C)',
                    ph: 'pH Level',
                    salinity: 'Salinity (ppt)',
                    dissolved_oxygen: 'Dissolved Oxygen (mg/L)',
                    ammonia: 'Ammonia (mg/L)',
                    nitrate: 'Nitrate (mg/L)',
                    nitrite: 'Nitrite (mg/L)',
                    alkalinity: 'Alkalinity (mg/L)',
                    turbidity: 'Turbidity (NTU)',
                  };

                  const firstDataPoint = chartData.multiParameterTrends[0];
                  if (!firstDataPoint) return null;

                  const parameters = Object.keys(firstDataPoint).filter(
                    (key) => key !== 'label' && key !== 'date'
                  );

                  return parameters.map((param, idx) => (
                    <Line
                      key={param}
                      type="monotone"
                      dataKey={param}
                      stroke={colors_chart[idx % colors_chart.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={paramLabels[param] || param}
                    />
                  ));
                })()}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 sm:h-64 text-gray-500">
            No data available
          </div>
        )}
      </div>

      {/* Heatmap + Historical Trends (tablet-friendly: only split on xl) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        {/* Correlation Heatmap */}
       <div
          className="bg-white rounded-lg border p-4 sm:p-6 min-w-0"
          style={{
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`,
          }}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            Parameter Correlations
          </h3>

          {(() => {
            const heatmap = chartData.correlationHeatmap;

            if (!heatmap || heatmap.parameters.length === 0) {
              return (
                <div className="flex items-center justify-center h-48 sm:h-64 text-gray-500">
                  No correlation data
                </div>
              );
            }

            const n = heatmap.parameters.length;

            const gridStyle = {
              gridTemplateColumns: `var(--labelW) repeat(${n}, var(--cell))`,
              gridTemplateRows: `var(--head) repeat(${n}, var(--cell))`,
              gap: 0,
            } as React.CSSProperties;

            return (
              <div className="flex flex-col lg:flex-row gap-4 min-w-0">
                {/* ✅ Heatmap (fixed column widths, responsive, no gaps, no chopped x-axis) */}
                <div className="flex-1 min-w-0 overflow-x-auto">
                  <div
                    className="
                      inline-grid text-xs
                      [--cell:36px] [--head:64px] [--labelW:96px]
                      sm:[--cell:40px] sm:[--head:68px] sm:[--labelW:110px]
                      lg:[--cell:44px] lg:[--head:72px] lg:[--labelW:120px]
                    "
                    style={gridStyle}
                  >
                    {/* top-left empty */}
                    <div />

                    {/* X-axis labels */}
                    {heatmap.parameters.map((param, idx) => (
                      <div
                        key={idx}
                        className="relative flex items-end justify-center"
                        style={{ height: "var(--head)", width: "var(--cell)", overflow: "visible" }}
                      >
                        <span
                          className="absolute bottom-2 left-1/2 text-gray-600 font-medium mb-3"
                          style={{
                            transform: "translateX(-50%) rotate(-45deg)",
                            transformOrigin: "bottom center",
                            fontSize: "10px",
                            lineHeight: 1,
                            marginLeft: "25%",
                          }}
                        >
                          {heatmap.parameterLabels[param] || param}
                        </span>
                      </div>
                    ))}

                    {/* Rows */}
                    {heatmap.matrix.map((row, rowIdx) => (
                      <div key={`rowwrap-${rowIdx}`} className="contents">
                        {/* Y-axis label */}
                        <div
                          className="text-gray-600 pr-2 text-right font-medium flex items-center justify-end"
                          style={{ width: "var(--labelW)", height: "var(--cell)" }}
                        >
                          <span style={{ fontSize: "10px", whiteSpace: "nowrap" }}>
                            {heatmap.parameterLabels[heatmap.parameters[rowIdx]] ||
                              heatmap.parameters[rowIdx]}
                          </span>
                        </div>

                        {/* Cells */}
                        {row.map((value, colIdx) => (
                          <div
                            key={`${rowIdx}-${colIdx}`}
                            className="flex items-center justify-center font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: getCorrelationColor(value),
                              color: Math.abs(value) > 0.5 ? "white" : "#374151",
                              width: "var(--cell)",
                              height: "var(--cell)",
                              fontSize: "11px",
                            }}
                            title={`${heatmap.parameters[rowIdx]} vs ${heatmap.parameters[colIdx]}: ${value.toFixed(
                              2
                            )}`}
                          >
                            {value.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scale legend */}
                <div className="w-full lg:w-24 shrink-0">
                  <div className="text-xs font-medium text-gray-700 mb-2">Scale</div>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-x-3 gap-y-1">
                    {[1.0, 0.8, 0.6, 0.4, 0.2, 0.0, -0.2, -0.4, -0.6, -0.8].map((val) => (
                      <div key={val} className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-3 rounded"
                          style={{ backgroundColor: getCorrelationColor(val) }}
                        />
                        <span className="text-xs text-gray-600">{val.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Historical Trends */}
        <div
          className="bg-white rounded-lg border p-4 sm:p-6 min-w-0"
          style={{
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`,
          }}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            Historical Trends of Key Parameters
          </h3>

          {chartData.historicalTrends.length > 0 ? (
            <div className="min-w-0">
              <ResponsiveContainer
                width="100%"
                height={360}
                key={`historical-${timeRange}-${chartData.historicalTrends.length}`}
              >
                <LineChart data={chartData.historicalTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    stroke="#9CA3AF"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" align="center" layout="horizontal" wrapperStyle={{paddingTop: '12px', fontSize: '11px', lineHeight: '1.4'}} />

                  {(() => {
                    const colors_chart = ['#F59E0B', colors.primary, '#3B82F6', '#10B981', '#8B5CF6'];
                    const paramLabels: Record<string, string> = {
                      temperature: 'Temperature (°C)',
                      ph: 'pH',
                      salinity: 'Salinity (ppt)',
                      dissolved_oxygen: 'Dissolved Oxygen (mg/L)',
                      ammonia: 'Ammonia (mg/L)',
                      nitrate: 'Nitrate (mg/L)',
                      turbidity: 'Turbidity (NTU)',
                    };

                    const firstDataPoint = chartData.historicalTrends[0];
                    if (!firstDataPoint) return null;

                    const parameters = Object.keys(firstDataPoint).filter(
                      (key) => key !== 'label' && key !== 'date'
                    );

                    return parameters.map((param, idx) => (
                      <Line
                        key={param}
                        type="monotone"
                        dataKey={param}
                        stroke={colors_chart[idx % colors_chart.length]}
                        strokeWidth={2}
                        dot={false}
                        name={paramLabels[param] || param}
                      />
                    ));
                  })()}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 sm:h-64 text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* NEW CHARTS - Session 1: Nitrogen Cycle + Temperature Trend */}
      
      {/* Nitrogen Cycle Monitoring (Multi-Line Chart) */}
      {chartData.nitrogenCycle && chartData.nitrogenCycle.length > 0 && (
        <div 
          className="bg-white rounded-lg border p-6"
          style={{ 
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 min-w-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Nitrogen Cycle Monitoring
                </h3>
                <div className="relative group">
                  <svg className="w-5 h-5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="absolute left-0 top-6 w-[min(24rem,calc(100vw-2rem))] p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="font-semibold mb-2">Nitrogen Cycle (Toxicity Management)</div>
                    <div className="space-y-2 text-xs">
                      {profileType === 'fish' ? (
                        <>
                          <p><strong>What:</strong> Tracks toxic nitrogen compounds: Nitrite (NO₂⁻) → Nitrate (NO₃⁻)</p>
                          <p><strong>Why:</strong> Fish are VERY sensitive to nitrite. Nitrite blocks oxygen transport causing "brown blood disease".</p>
                          <p><strong>Critical Levels:</strong></p>
                          <ul className="list-disc ml-4 space-y-1">
                            <li>Nitrite: &gt;0.4 mg/L = oxygen transport failure</li>
                            <li>Nitrate: &gt;40 mg/L = algae bloom risk</li>
                          </ul>
                          <p className="text-yellow-300 mt-2"><strong>⚠️ Note:</strong> Toxicity increases with pH and temperature. Maintain good biological filtration.</p>
                        </>
                      ) : (
                        <>
                          <p><strong>What:</strong> Tracks toxic progression: Feed waste → Ammonia (NH₃) → Nitrite (NO₂⁻) → Nitrate (NO₃⁻) + Phosphorus</p>
                          <p><strong>Why:</strong> Shrimp are sensitive to ammonia and nitrite. Unionized ammonia passes through membranes causing toxicity. Nitrite blocks oxygen transport.</p>
                          <p><strong>Critical Levels:</strong></p>
                          <ul className="list-disc ml-4 space-y-1">
                            <li>Ammonia: &gt;1.0 mg/L = immediate damage</li>
                            <li>Nitrite: &gt;0.4 mg/L = oxygen transport failure</li>
                            <li>Nitrate: &gt;40 mg/L = algae bloom risk</li>
                            <li>Phosphorus: drives algae growth when combined with nitrogen</li>
                          </ul>
                          <p className="text-yellow-300 mt-2"><strong>⚠️ Note:</strong> Toxicity increases with pH and temperature. 72-89% of feed nutrients become waste.</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {profileType === 'fish' 
                  ? 'Track nitrogen compounds (Nitrite → Nitrate) for toxicity prevention'
                  : 'Track nitrogen compounds (Ammonia → Nitrite → Nitrate) for toxicity prevention'
                }
              </p>
            </div>
          </div>

          {/* Render chart with error boundary */}
          {(() => {
            try {
              return (
                <MultiLineChart 
                  data={chartData.nitrogenCycle}
                  parameters={nitrogenParams}
                  colors={colors}
                />
              );
            } catch (err) {
              console.error('Error rendering Nitrogen Cycle chart:', err);
              return <div className="text-red-500 p-4">Error loading chart</div>;
            }
          })()}
        </div>
      )}

      {/* Temperature Trend Analysis (Single-Line Chart) */}
      {chartData.temperatureTrend && chartData.temperatureTrend.length > 0 && (
        <div 
          className="bg-white rounded-lg border p-6"
          style={{ 
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 min-w-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Temperature Trend Analysis
              </h3>
              <p className="text-sm text-gray-600">
                Detailed temperature monitoring with optimal range indicators
              </p>
            </div>
          </div>

          {/* Render chart with error boundary */}
          {(() => {
            try {
              return (
                <SingleLineChart 
                  data={chartData.temperatureTrend}
                  parameter={tempParam}
                  colors={colors}
                />
              );
            } catch (err) {
              console.error('Error rendering Temperature Trend chart:', err);
              return <div className="text-red-500 p-4">Error loading chart</div>;
            }
          })()}
        </div>
      )}

      {/* SESSION 2 CHARTS - Dissolved Oxygen, Disease Risk, WQI */}
      
      {/* Dissolved Oxygen Monitoring (Single-Line Chart with Critical Zones) */}
      {chartData.dissolvedOxygen && chartData.dissolvedOxygen.length > 0 && (
        <div 
          className="bg-white rounded-lg border p-4 sm:p-6 min-w-0"
          style={{ 
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 min-w-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Dissolved Oxygen Monitoring
              </h3>
              <p className="text-sm text-gray-600">
                Critical oxygen levels - fish require &gt;5 mg/L for survival
              </p>
            </div>
          </div>

          {(() => {
            try {
              return (
                <SingleLineChart 
                  data={chartData.dissolvedOxygen}
                  parameter={doParam}
                  colors={colors}
                />
              );
            } catch (err) {
              console.error('Error rendering DO Monitoring chart:', err);
              return <div className="text-red-500 p-4">Error loading chart</div>;
            }
          })()}
        </div>
      )}

      {/* Disease Risk Assessment (Composed Chart with Bars + Lines) */}
      {chartData.diseaseRisk && chartData.diseaseRisk.length > 0 && (
        <div 
          className="bg-white rounded-lg border p-4 sm:p-6 min-w-0"
          style={{ 
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 min-w-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Disease Risk Assessment
                </h3>
                <div className="relative group">
                  <svg className="w-5 h-5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="absolute left-0 top-6 w-[min(24rem,calc(100vw-2rem))] p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="font-semibold mb-2">Disease Risk Assessment (Multi-Factorial)</div>
                    <div className="space-y-2 text-xs">
                      <p><strong>What:</strong> Tracks 4 independent risk factors based on water quality and bacterial load.</p>
                      <p><strong>Metrics:</strong></p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li><strong>Bacterial Load:</strong> Total bacterial count (CFU/ml). Safe: &lt;10,000, Danger: &gt;50,000</li>
                        <li><strong>Toxicity Stress:</strong> From elevated ammonia + nitrite levels affecting immune function</li>
                        <li><strong>Environmental Stress:</strong> From pH and dissolved oxygen deviations from optimal ranges</li>
                        <li><strong>Overall Risk:</strong> Composite score (0-100) combining all factors</li>
                      </ul>
                      <p className="text-red-300 mt-2"><strong>⚠️ Critical:</strong> Risk &gt;70 = high disease outbreak probability. Stress is the #1 precursor to disease - 80% of fish diseases are secondary to environmental stress.</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Bacterial load, toxicity stress, environmental stress, and overall risk index
              </p>
            </div>
          </div>

          {(() => {
            try {
              return (
                <DiseaseRiskChart 
                  data={chartData.diseaseRisk}
                  colors={colors}
                />
              );
            } catch (err) {
              console.error('Error rendering Disease Risk chart:', err);
              return <div className="text-red-500 p-4">Error loading chart</div>;
            }
          })()}
        </div>
      )}

      {/* Water Quality Index (WQI) - 5 Component Parameters */}
      {chartData.waterQualityIndex && chartData.waterQualityIndex.length > 0 && (
        <div 
          className="bg-white rounded-lg border p-4 sm:p-6 min-w-0"
          style={{ 
            borderColor: `${colors.primary}20`,
            boxShadow: `0 2px 4px ${colors.primary}10`
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 min-w-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Water Quality Index (WQI)
                </h3>
                <div className="relative group">
                  <svg className="w-5 h-5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="absolute left-0 top-6 w-[min(24rem,calc(100vw-2rem))] p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="font-semibold mb-2">Water Quality Index (Ecosystem Health)</div>
                    <div className="space-y-2 text-xs">
                      <p><strong>What:</strong> Composite score (0-100) summarizing overall environmental health across 5 parameters.</p>
                      <p><strong>Components:</strong></p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li><strong>Algae Bloom:</strong> Chlorophyll-a concentration. Optimal: 30-50, Excessive: &gt;60 (risk of oxygen crashes)</li>
                        <li><strong>Clarity:</strong> Water transparency (Secchi disk depth). Optimal: 30-60 cm for feeding efficiency</li>
                        <li><strong>Hardness:</strong> Calcium/magnesium content. Essential for osmoregulation and bone formation</li>
                        <li><strong>Alkalinity:</strong> pH buffering capacity. Prevents pH crashes from algae activity</li>
                        <li><strong>WQI Score:</strong> Weighted composite: pH(15%) + DO(35%) + Temp(15%) + Ammonia(25%) + Turbidity(10%)</li>
                      </ul>
                      <p className="text-green-300 mt-2"><strong>Thresholds:</strong> Excellent: &gt;80, Good: 60-80, Poor: &lt;60 (immediate action needed)</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Algae bloom risk, water clarity, hardness, alkalinity, and composite WQI score
              </p>
            </div>
          </div>

          {(() => {
            try {
              return (
                <WQIChart 
                  data={chartData.waterQualityIndex}
                  colors={colors}
                />
              );
            } catch (err) {
              console.error('Error rendering WQI chart:', err);
              return <div className="text-red-500 p-4">Error loading chart</div>;
            }
          })()}
        </div>
      )}

    </div>
  );
}
