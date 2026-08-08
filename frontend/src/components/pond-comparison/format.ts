export function hexA(hex: string, alpha: number): string {
  const safeHex = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#6b7280";
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `${safeHex}${a}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDay(iso: string, withYear = false): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

export function dayCount(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T00:00:00`);
  const e = new Date(`${endIso}T00:00:00`);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
