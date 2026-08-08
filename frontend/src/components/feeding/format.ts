const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtD(iso: string): string {
  const p = iso.split("-");
  return `${+p[2]} ${MONTHS[+p[1] - 1]}`;
}

function fmtDY(iso: string): string {
  return `${fmtD(iso)} ${iso.slice(0, 4)}`;
}

export function fmtRange(start: string, end: string | null): string {
  return `${fmtDY(start)} – ${end ? fmtDY(end) : "Ongoing"}`;
}
