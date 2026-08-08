import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { hexA } from "./stageBandsPlugin";
import type { CycleTemplate } from "./types";

export interface GridDay {
  day: number;
  color: string;
  faded?: boolean;
  clickable?: boolean;
  isToday?: boolean;
  marker?: string;
}

interface StageDayGridProps {
  template: CycleTemplate;
  days: GridDay[];
  selectedStage: number;
  onSelectStage: (index: number) => void;
  accentColor: string;
  stageIndicators?: (React.ReactNode | null)[];
  onDayClick?: (day: number) => void;
  infoFor?: (day: number) => React.ReactNode;
  summary?: React.ReactNode;
}

const MIN_TAB_WIDTH = 150;

export function StageDayGrid({
  template,
  days,
  selectedStage,
  onSelectStage,
  accentColor,
  stageIndicators,
  onDayClick,
  infoFor,
  summary,
}: StageDayGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const stages = template.stages;
  const perPage = width ? Math.max(1, Math.min(stages.length, Math.floor(width / MIN_TAB_WIDTH))) : stages.length;
  const pageCount = Math.ceil(stages.length / perPage);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPage(Math.min(Math.floor(selectedStage / perPage), pageCount - 1));
  }, [selectedStage, perPage, pageCount]);

  const visible = stages.slice(page * perPage, page * perPage + perPage);
  const stage = stages[selectedStage];
  const stageDays = days.filter((d) => d.day >= stage.startDay && d.day <= stage.endDay);

  return (
    <div ref={containerRef}>
      <div className="flex items-stretch overflow-hidden rounded-t-lg border border-gray-200 bg-white">
        {pageCount > 1 && (
          <button
            type="button"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className={clsx("px-1", page === 0 ? "opacity-25" : "hover:bg-gray-50")}
            aria-label="Previous stages"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
        )}
        {visible.map((st) => {
          const index = stages.indexOf(st);
          const isActive = index === selectedStage;
          return (
            <button
              key={st.name}
              type="button"
              onClick={() => onSelectStage(index)}
              className={clsx(
                "relative flex-1 border-l border-gray-200 p-2.5 text-center transition-colors first:border-l-0",
                !isActive && "hover:bg-gray-50",
              )}
              style={isActive ? { backgroundColor: hexA(accentColor, 0.08) } : undefined}
            >
              <div className="text-xs font-semibold" style={{ color: isActive ? accentColor : "#374151" }}>
                {st.name}
              </div>
              <div
                className={clsx("flex items-center justify-center gap-1 text-[10px]", isActive ? "font-medium" : "text-gray-500")}
                style={isActive ? { color: accentColor } : undefined}
              >
                d{st.startDay}–{st.endDay}
                {stageIndicators?.[index]}
              </div>
            </button>
          );
        })}
        {pageCount > 1 && (
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
            disabled={page === pageCount - 1}
            className={clsx("px-1", page === pageCount - 1 ? "opacity-25" : "hover:bg-gray-50")}
            aria-label="More stages"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-x border-gray-200 bg-white py-1.5">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: i === page ? accentColor : "#D1D5DB" }}
              aria-label={`Stage page ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div
        className="space-y-3 rounded-b-lg border border-t-0 border-gray-200 px-3 pb-3 pt-4"
        style={{ backgroundColor: hexA(accentColor, 0.04) }}
      >
        <div className="flex justify-center">
          <div
            className="flex flex-wrap justify-center gap-x-1.5 gap-y-5 pb-3"
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setHoveredDay(null);
            }}
          >
            {stageDays.map((d) => (
              <div key={d.day} className="relative flex justify-center">
                <button
                  type="button"
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setHoveredDay(d.day);
                  }}
                  onClick={() => {
                    if (d.clickable && onDayClick) {
                      onDayClick(d.day);
                    } else {
                      setHoveredDay(hoveredDay === d.day ? null : d.day);
                    }
                  }}
                  disabled={!d.clickable && !infoFor}
                  className={clsx(
                    "flex h-9 w-9 touch-manipulation items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm transition-transform",
                    d.faded && "opacity-40",
                    d.clickable && "hover:scale-110 hover:ring-2 hover:ring-offset-1",
                    hoveredDay === d.day && !d.faded && "scale-110 ring-2 ring-offset-1",
                  )}
                  style={
                    {
                      backgroundColor: d.color,
                      WebkitTapHighlightColor: "transparent",
                      "--tw-ring-color": hexA(d.color, 0.45),
                    } as React.CSSProperties
                  }
                >
                  {d.day}
                </button>
                {d.isToday ? (
                  <span
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold"
                    style={{ color: accentColor }}
                  >
                    TODAY
                  </span>
                ) : (
                  d.marker && (
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-gray-400">
                      {d.marker}
                    </span>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {infoFor && hoveredDay != null && (
          <div className="rounded-lg bg-white/80 px-3 py-2 text-xs text-gray-700">{infoFor(hoveredDay)}</div>
        )}

        {summary}
      </div>
    </div>
  );
}
