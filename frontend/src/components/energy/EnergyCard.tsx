import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { clsx } from "clsx";

interface EnergyCardProps {
  title?: string;
  info?: string;
  /** right-aligned slot in the header (e.g. a "View All" link). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Titled white rounded card used across the Energy Consumption page. */
export function EnergyCard({ title, info, action, children, className }: EnergyCardProps) {
  return (
    <section className={clsx("rounded-xl border border-gray-200 bg-white p-5", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            {title}
            <span title={info} className={clsx(info && "cursor-help")}>
              <Info className="h-3.5 w-3.5 text-gray-400" />
            </span>
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
