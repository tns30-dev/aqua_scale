import { Zap } from "lucide-react";
import { useProfileTheme } from "../../context/ProfileContext";
import { C, hexA, windowDays } from "./data";

// Electricity block (treatment_stability.md · decided 27 Jul 2026): the
// cost of sustaining the stability above. Lives inside the stability card,
// template-tinted like its sibling blocks. Total cost as the hero, with
// the attributes that explain it. No saved/baseline claims. Binary rule:
// the parent only renders this when the window has electricity readings.

interface Props {
  win: { start: string; end: string };
  todayIso: string;
  power: { kwh: number; cost: number; tariff: number; currency: string };
}

export function ElectricityPanel({ win, todayIso, power }: Props) {
  const theme = useProfileTheme();
  const days = windowDays(win, todayIso);
  const perHour = power.kwh / (days * 24);
  const currency = power.currency || "S$";

  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: hexA(theme.primary, 0.4), backgroundColor: hexA(theme.primary, 0.04) }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.primary }}>
        <Zap className="h-4 w-4" /> Electricity · power to sustain it
      </div>
      <div className="mt-2">
        <span className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: C.goodInk }}>{currency}&nbsp;{power.cost}</span>
        <p className="mt-1.5 text-[13px] text-gray-700">to hold the water stable over the {days} days.</p>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-3 border-t pt-3.5" style={{ borderTopColor: hexA(theme.primary, 0.2) }}>
        <div>
          <div className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-gray-500">Energy used</div>
          <div className="mt-1 text-[17px] font-extrabold tabular-nums text-gray-900">{power.kwh} kWh</div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-gray-500">Average use</div>
          <div className="mt-1 text-[17px] font-extrabold tabular-nums text-gray-900">{perHour.toFixed(1)} <span className="text-[12px] font-bold text-gray-500">kWh per hour</span></div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-gray-500">Your tariff</div>
          <div className="mt-1 text-[17px] font-extrabold tabular-nums text-gray-900">{currency} {power.tariff.toFixed(3)} <span className="text-[12px] font-bold text-gray-500">per kWh</span></div>
        </div>
      </div>
    </div>
  );
}
