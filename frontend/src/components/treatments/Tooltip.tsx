import { createContext, useContext, useState, type ReactNode } from "react";

// A tiny shared floating-tooltip layer. Any descendant calls `useTip()` to get
// mouse handlers bound to a message; the provider renders one fixed tip div.

type TipHandlers = {
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
};

const noop: TipHandlers = { onMouseEnter: () => {}, onMouseMove: () => {}, onMouseLeave: () => {} };
const TipContext = createContext<(text: string) => TipHandlers>(() => noop);

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const bind = (text: string): TipHandlers => ({
    onMouseEnter: (e) => setTip({ x: e.clientX, y: e.clientY, text }),
    onMouseMove: (e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)),
    onMouseLeave: () => setTip(null),
  });

  return (
    <TipContext.Provider value={bind}>
      {children}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[250px] rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-white shadow-xl"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 260), top: tip.y + 16 }}
        >
          {tip.text}
        </div>
      )}
    </TipContext.Provider>
  );
}

export const useTip = () => useContext(TipContext);
