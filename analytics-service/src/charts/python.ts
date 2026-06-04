/**
 * Python-semantics helpers — the monolith chart engine is CPython; its rounding,
 * title-casing and Pearson correlation behaviors are part of the wire contract.
 */

/**
 * Python `round(x, 2)`: nearest multiple of 0.01 with ties-to-even, evaluated on the
 * binary double (so round(2.675, 2) === 2.67 — 2.675 is stored below the midpoint).
 * JS `Math.round` is half-up and would drift on exactly representable midpoints
 * (e.g. 0.125 -> Python 0.12, Math.round 0.13).
 */
export function round2(x: number): number {
  if (!Number.isFinite(x)) {
    return x;
  }
  // CPython rounds the EXACT decimal expansion of the double; multiplying by 100 in
  // floating point would corrupt near-midpoint cases (2.675*100 -> exactly 267.5).
  // toFixed(20) is a correctly-rounded 20-digit expansion — precise enough to classify
  // above/below/tie, since true ties (.xx5 exactly) are dyadic and expand finitely.
  const negative = x < 0;
  const s = Math.abs(x).toFixed(20);
  const dot = s.indexOf('.');
  const frac = s.slice(dot + 1);                  // 20 digits
  let units = Number(s.slice(0, dot)) * 100 + Number(frac.slice(0, 2));
  const rest = frac.slice(2);                     // 18 digits
  const midpoint = '5' + '0'.repeat(17);
  if (rest > midpoint) {                          // equal-length digit strings compare numerically
    units += 1;
  } else if (rest === midpoint && units % 2 === 1) {
    units += 1;                                   // tie -> even
  }
  const result = units / 100;
  return negative ? -result : result;
}

/**
 * Python `str.title()` for the heatmap's parameterLabels: a letter is uppercased when
 * the previous character is not a letter, lowercased otherwise. Yields the monolith's
 * exact labels: "ph" -> "Ph", "dissolved oxygen" -> "Dissolved Oxygen".
 */
export function pyTitle(s: string): string {
  let out = '';
  let prevIsAlpha = false;
  for (const ch of s) {
    const isAlpha = /[a-zA-Z]/.test(ch);
    if (isAlpha) {
      out += prevIsAlpha ? ch.toLowerCase() : ch.toUpperCase();
    } else {
      out += ch;
    }
    prevIsAlpha = isAlpha;
  }
  return out;
}

/** statistics.mean equivalent (plain arithmetic mean). */
export function mean(values: number[]): number {
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

/**
 * statistics.correlation equivalent (Pearson). Throws on zero variance — the caller
 * maps that to 0.0 exactly like the monolith's StatisticsError handler.
 */
export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  if (denom === 0) {
    throw new Error('zero variance'); // parity: StatisticsError -> caught -> 0.0
  }
  return sxy / denom;
}
