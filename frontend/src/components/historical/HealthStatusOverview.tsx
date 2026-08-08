import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useCycleStore } from '../../stores/cycleStore';
import { apiService } from '../../services/api.service';
import { getProfileColors, getHealthStatusColor } from '../../utils/profileColors';

export function HealthStatusOverview() {
  const {
    cycles,
    currentCycle,
    profileTemplate,
    setCurrentCycle,
    setLoading,
  } = useCycleStore();

  const colors = getProfileColors(profileTemplate?.profileType || 'shrimp');

  // Hovered/tapped day for info bar below circles
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Selected stage (default to first stage once template exists)
  const [selectedStage, setSelectedStage] = useState<string>(
    profileTemplate?.stages[0]?.name || 'Post-Larvae Stocking'
  );

  // Transition state for animation
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- Mobile/Tablet stage carousel refs/state ---
  const stageScrollRef = useRef<HTMLDivElement | null>(null);
  const stageScrollEndTimer = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);

  const stages = useMemo(() => profileTemplate?.stages ?? [], [profileTemplate?.stages]);

  const selectedStageIndex = useMemo(() => {
    const idx = stages.findIndex((s) => s.name === selectedStage);
    return idx >= 0 ? idx : 0;
  }, [stages, selectedStage]);

  // Calculate "today" for ongoing cycles
  const today = useMemo(() => {
    if (!currentCycle || currentCycle.cycle.status === 'completed') return null;

    const startDate = new Date(currentCycle.cycle.startDate);
    const now = new Date();
    const daysDiff =
      Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const cycleDays = profileTemplate?.cycleLengthDays || 90;
    return daysDiff >= 1 && daysDiff <= cycleDays ? daysDiff : null;
  }, [currentCycle, profileTemplate]);

  // Handle cycle navigation with animation
  const handleCycleChange = async (direction: 'prev' | 'next') => {
    if (!currentCycle || isTransitioning) return;

    const currentIndex = cycles.findIndex((c) => c.cycleId === currentCycle.cycle.cycleId);
    const newIndex = direction === 'prev' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < cycles.length) {
      try {
        setIsTransitioning(true);
        setLoading(true);

        await new Promise((resolve) => setTimeout(resolve, 150));

        const newCycleDetails = await apiService.getCycleDetails(cycles[newIndex].cycleId);
        setCurrentCycle(newCycleDetails);

        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (error) {
        console.error('Error loading cycle:', error);
      } finally {
        setLoading(false);
        setIsTransitioning(false);
      }
    }
  };

  // Get current stage details
  const currentStageInfo = useMemo(() => {
    return profileTemplate?.stages.find((s) => s.name === selectedStage);
  }, [profileTemplate, selectedStage]);

  // Get metrics for selected stage
  const stageMetrics = useMemo(() => {
    if (!currentCycle || !selectedStage) return null;
    return currentCycle.stageMetrics[selectedStage];
  }, [currentCycle, selectedStage]);

  // True only when at least one of this profile's key indicators actually has
  // a recorded value. Empty metrics should render an explicit state instead of
  // making the stage panel look broken.
  const hasStageMetrics = useMemo(
    () =>
      Boolean(
        stageMetrics &&
          profileTemplate?.keyIndicators?.some((indicator) => stageMetrics[indicator]),
      ),
    [stageMetrics, profileTemplate],
  );

  // Filter daily health for current stage
  const stageDailyHealth = useMemo(() => {
    if (!currentCycle || !selectedStage) return [];
    return currentCycle.dailyHealth.filter((day) => day.stageName === selectedStage);
  }, [currentCycle, selectedStage]);

  // Determine completed stages (all days passed)
  const completedStages = useMemo(() => {
    if (!profileTemplate || !currentCycle) return [];
    const lastDay = Math.max(...currentCycle.dailyHealth.map((d) => d.dayNumber));
    return profileTemplate.stages
      .filter((stage) => stage.endDay <= lastDay)
      .map((stage) => stage.name);
  }, [profileTemplate, currentCycle]);

  // Keep selectedStage valid when template changes
  useEffect(() => {
    if (!profileTemplate?.stages?.length) return;

    const exists = profileTemplate.stages.some((s) => s.name === selectedStage);
    if (!exists) setSelectedStage(profileTemplate.stages[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileTemplate?.stages?.length]);

  // Scroll carousel to selected stage (when user taps a stage or when selectedStage changes programmatically)
  useEffect(() => {
    const el = stageScrollRef.current;
    if (!el) return;

    // Only for mobile/tablet (lg:hidden area); safe to run anyway
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: selectedStageIndex * el.clientWidth, behavior: 'smooth' });

    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 350);
  }, [selectedStageIndex]);

  const getCurrentStageIndexFromScroll = () => {
    const el = stageScrollRef.current;
    if (!el) return 0;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    return Math.max(0, Math.min(stages.length - 1, page));
  };

  const handleStageScroll = () => {
    // debounce to "scroll end" so we select stage AFTER the swipe settles
    if (stageScrollEndTimer.current) window.clearTimeout(stageScrollEndTimer.current);

    stageScrollEndTimer.current = window.setTimeout(() => {
      if (isProgrammaticScroll.current) return;

      const idx = getCurrentStageIndexFromScroll();
      const stage = stages[idx];
      if (stage && stage.name !== selectedStage) {
        // IMPORTANT: this triggers the whole content refresh automatically
        setSelectedStage(stage.name);
      }
    }, 120);
  };

  const goToStageIndex = (idx: number) => {
    const el = stageScrollRef.current;
    const clamped = Math.max(0, Math.min(stages.length - 1, idx));
    const stage = stages[clamped];
    if (!el || !stage) return;

    // set stage FIRST (content refresh), then scroll (keeps UI aligned)
    setSelectedStage(stage.name);

    isProgrammaticScroll.current = true;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 350);
  };

  if (!currentCycle || !profileTemplate) return <div>No cycle data available</div>;

  const currentIndex = cycles.findIndex((c) => c.cycleId === currentCycle.cycle.cycleId);
  const hasPrev = currentIndex < cycles.length - 1;
  const hasNext = currentIndex > 0;

  return (
    <div className={`transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      {/* Cycle Navigation */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-4 sm:gap-8 mb-2">
          <button
            onClick={() => handleCycleChange('prev')}
            disabled={!hasPrev}
            className={`p-2 rounded-lg transition-all ${hasPrev ? 'hover:bg-gray-100' : 'invisible'}`}
            style={{ color: colors.primary }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
            Health Status Overview - {profileTemplate?.cycleLengthDays || 90} Day Cycle
          </h3>

          <button
            onClick={() => handleCycleChange('next')}
            disabled={!hasNext}
            className={`p-2 rounded-lg transition-all ${hasNext ? 'hover:bg-gray-100' : 'invisible'}`}
            style={{ color: colors.primary }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm" style={{ color: colors.primary }}>
          Cycle {currentIndex + 1} ({currentCycle.cycle.displayName})
        </p>
      </div>

      {/* Stage Timeline */}
      <div className="mb-0">
        {/* Desktop (show all stages) */}
        <div className="hidden lg:block">
          <div className="flex bg-white rounded-t-lg overflow-hidden border border-gray-200">
            {profileTemplate.stages.map((stage, index) => {
              const isActive = stage.name === selectedStage;
              const isCompleted = completedStages.includes(stage.name);
              const stageDays = stage.endDay - stage.startDay + 1;

              return (
                <button
                  key={stage.name}
                  onClick={() => setSelectedStage(stage.name)}
                  className={`
                    flex-1 p-4 text-center transition-all relative
                    ${index > 0 ? 'border-l border-gray-200' : ''}
                    ${isActive ? '' : 'hover:bg-gray-50'}
                  `}
                  style={isActive ? { backgroundColor: colors.light, color: colors.primary } : undefined}
                >
                  {isCompleted && !isActive && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                  )}

                  <div className="text-sm font-semibold mb-1" style={{ color: isActive ? colors.primary : '#374151' }}>
                    {stage.name}
                  </div>
                  <div className={`text-xs ${isActive ? '' : 'text-gray-500'}`}>{stageDays} days</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile + Tablet: 1 stage per page swipe carousel + iPhone dots */}
        <div className="lg:hidden">
          <style>{`
            .hide-scrollbar::-webkit-scrollbar { display: none; }
          `}</style>

          <div
            ref={stageScrollRef}
            onScroll={handleStageScroll}
            className="
              hide-scrollbar bg-white rounded-t-lg border border-gray-200
              overflow-x-auto scroll-smooth
              snap-x snap-mandatory
              [-ms-overflow-style:none] [scrollbar-width:none]
            "
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex w-full">
              {profileTemplate.stages.map((stage) => {
                const isActive = stage.name === selectedStage;
                const isCompleted = completedStages.includes(stage.name);
                const stageDays = stage.endDay - stage.startDay + 1;

                return (
                  <div
                    key={stage.name}
                    className="w-full snap-center"
                    style={{ flex: '0 0 100%' }}
                  >
                    <button
                      onClick={() => setSelectedStage(stage.name)}
                      className={`
                        relative w-full p-4 text-center transition-all
                        ${isActive ? '' : 'hover:bg-gray-50'}
                      `}
                      style={isActive ? { backgroundColor: colors.light, color: colors.primary } : undefined}
                    >
                      {isCompleted && !isActive && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                      )}

                      <div className="text-sm font-semibold mb-1" style={{ color: isActive ? colors.primary : '#374151' }}>
                        {stage.name}
                      </div>
                      <div className={`text-xs ${isActive ? '' : 'text-gray-500'}`}>{stageDays} days</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dots + arrows (like iPhone) */}
          <div className="flex items-center justify-center gap-2 bg-white border-x border-b border-gray-200 py-2">
            <button
              type="button"
              onClick={() => goToStageIndex(selectedStageIndex - 1)}
              disabled={selectedStageIndex === 0}
              className={`p-1 rounded-md ${selectedStageIndex === 0 ? 'opacity-30' : 'hover:bg-gray-100'}`}
              aria-label="Previous stage"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {profileTemplate.stages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToStageIndex(i)}
                  className="h-2 w-2 rounded-full transition-all"
                  style={{
                    backgroundColor: i === selectedStageIndex ? colors.primary : '#D1D5DB',
                    opacity: i === selectedStageIndex ? 1 : 0.8,
                  }}
                  aria-label={`Go to stage ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => goToStageIndex(selectedStageIndex + 1)}
              disabled={selectedStageIndex === profileTemplate.stages.length - 1}
              className={`p-1 rounded-md ${
                selectedStageIndex === profileTemplate.stages.length - 1 ? 'opacity-30' : 'hover:bg-gray-100'
              }`}
              aria-label="Next stage"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile-themed background - starts immediately below progress bar */}
      <div
        className="border border-t-0 border-gray-200 rounded-b-lg p-6 space-y-6"
        style={{ backgroundColor: colors.light }}
      >
        {/* Key Indicator Cards */}
        {!hasStageMetrics && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 p-4 text-center">
            <p className="text-sm font-medium text-gray-700">
              No growth measurements recorded for this stage yet
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Body weight, growth rate and mortality are measured by sampling the pond,
              then entered by an administrator.
            </p>
          </div>
        )}

        {hasStageMetrics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {profileTemplate.keyIndicators.map((indicator) => {
              const metric = stageMetrics?.[indicator];
              if (!metric) return null;

              const labels: Record<string, { label: string; unit: string }> = {
                body_weight: { label: 'Mean Body Weight', unit: 'g' },
                daily_gain: { label: 'Avg Daily Gain', unit: 'g/day' },
                fcr: { label: 'Feed Conversion Ratio', unit: '' },
                mortality_rate: { label: 'Mortality Rate', unit: '%' },

                disease_risk_index: { label: 'Disease Risk Index', unit: '/100' },
                length_gained: { label: 'Length Gained', unit: 'cm' },
                feed_conversion_ratio: { label: 'Feed Conversion Ratio', unit: '' },
                condition_factor: { label: 'Condition Factor', unit: '' },
              };

              const info = labels[indicator];

              return (
                <div
                  key={indicator}
                  className="rounded-lg p-4 text-white text-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  <div className="font-semibold text-sm mb-3">
                    {info.label} {info.unit && `(${info.unit})`}
                  </div>

                  <div className="flex items-end justify-center gap-4">
                    <div className="text-2xl sm:text-2xl xl:text-3xl font-bold">{metric.current}</div>

                    <div className="text-right">
                      <div className="text-xs opacity-75">Min</div>
                      <div className="text-base sm:text-lg font-semibold">{metric.min}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs opacity-75">Max</div>
                      <div className="text-base sm:text-lg font-semibold">{metric.max}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stage Title & Description */}
        {currentStageInfo && (
          <div className="rounded-lg p-4 text-center">
            <h4 className="font-semibold text-gray-900 mb-1">{currentStageInfo.name}</h4>
            <p className="text-sm text-gray-600">
              Days {currentStageInfo.startDay}-{currentStageInfo.endDay}:
              {currentStageInfo.name === 'Post-Larvae Stocking' && ' Initial stocking and acclimatization'}
              {currentStageInfo.name === 'Early Growth Monitoring' && ' Early development and feeding establishment'}
              {currentStageInfo.name === 'Sub-Adult Development' && ' Rapid growth and biomass accumulation'}
              {currentStageInfo.name === 'Harvest Ready' && ' Final growth phase and harvest preparation'}
            </p>
          </div>
        )}

        {/* Day Circles */}
        <div className="flex justify-center">
          <div
            className="flex flex-wrap justify-center gap-2 max-w-6xl p-2"
            onMouseLeave={() => setHoveredDay(null)}
          >
            {stageDailyHealth.map((day) => {
              const isToday = day.dayNumber === today;
              const isFuture = today !== null && day.dayNumber > today;
              const isHovered = hoveredDay === day.dayNumber;

              return (
                <div key={day.dayNumber} className="relative flex justify-center">
                  <div
                    onMouseEnter={() => setHoveredDay(day.dayNumber)}
                    onClick={() => setHoveredDay(isHovered ? null : day.dayNumber)}
                    className={`
                      w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center
                      text-white text-sm sm:text-base font-semibold transition-all shadow-md
                      ${isFuture ? 'opacity-50' : 'cursor-pointer hover:ring-4 hover:ring-offset-2 hover:scale-110'}
                      ${isHovered && !isFuture ? 'ring-4 ring-offset-2 scale-110' : ''}
                    `}
                    style={{
                      backgroundColor: isFuture ? '#9CA3AF' : getHealthStatusColor(day.healthStatus),
                    }}
                  >
                    {day.dayNumber}
                  </div>

                  {isToday && (
                    <div
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-sm font-bold whitespace-nowrap"
                      style={{ color: colors.primary }}
                    >
                      TODAY
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Info Bar */}
        {(() => {
          const day = stageDailyHealth.find((d) => d.dayNumber === hoveredDay);
          if (!day) return null;

          const isFuture = today !== null && day.dayNumber > today;
          if (isFuture) return (
            <div className="bg-gray-100 text-gray-600 text-sm rounded-lg py-3 px-4 text-center">
              Day {day.dayNumber} — Future (not yet reached)
            </div>
          );

          const issues: string[] = [];
          if (day.alertCount >= 1) {
            if (currentStageInfo?.name.includes('Post-Larvae')) issues.push('High mortality detected');
            else if (currentStageInfo?.name.includes('Early Growth')) issues.push('Slow growth rate');
            else if (currentStageInfo?.name.includes('Sub-Adult')) issues.push('FCR elevated (3.00)');
            else issues.push('Water quality concern');
          }
          if (day.alertCount >= 2) issues.push('Temperature fluctuation');
          if (day.alertCount >= 3) issues.push('DO levels low');

          return (
            <div className="bg-gray-100 text-gray-700 text-sm rounded-lg py-3 px-4 text-center">
              <span className="font-semibold">Day {day.dayNumber}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span>{currentStageInfo?.name || 'Unknown Stage'}</span>
              <span className="text-gray-400 mx-1">·</span>
              {day.alertCount > 0 ? (
                <span>
                  {day.healthStatus === 'poor' ? '🔴' : day.healthStatus === 'fair' ? '🟠' : '🟡'}
                  {' '}{issues.join(', ')}
                </span>
              ) : (
                <span>✅ All parameters normal</span>
              )}
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-gray-400">{new Date(day.date).toLocaleDateString()}</span>
            </div>
          );
        })()}

        {/* Health Legend */}
        <div className="flex flex-wrap gap-4 justify-center text-sm sm:text-base pt-4">
          {[
            { status: 'excellent', label: 'Excellent (0 issues)' },
            { status: 'good', label: 'Good (1 issue)' },
            { status: 'fair', label: 'Fair (2 issues)' },
            { status: 'poor', label: 'Poor (3+ issues)' },
            { status: 'future', label: 'Future (Not reached)' },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                style={{ backgroundColor: getHealthStatusColor(status) }}
              />
              <span className="text-gray-700">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
