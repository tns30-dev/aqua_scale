import { describe, expect, it } from 'vitest';
import { mean, pearson, pyTitle, round2 } from '../src/charts/python';

describe('round2 — Python round(x, 2) parity (banker\'s rounding on binary doubles)', () => {
  it('rounds plain values like Python', () => {
    expect(round2(28.45)).toBe(28.45);
    expect(round2(28.456)).toBe(28.46);
    expect(round2(6.1000000000000005)).toBe(6.1);
  });

  it('ties go to even on exactly-representable midpoints', () => {
    expect(round2(0.125)).toBe(0.12);  // Python: round(0.125, 2) == 0.12
    expect(round2(0.375)).toBe(0.38);  // 37.5 -> even is 38? No: 37/38, even=38
  });

  it('binary-below-midpoint rounds down like Python (the 2.675 classic)', () => {
    expect(round2(2.675)).toBe(2.67);  // 2.675 is stored as 2.67499... -> 2.67
    expect(round2(0.135)).toBe(0.14);  // 0.135 is stored as 0.13500...09 -> 0.14
  });

  it('handles negatives', () => {
    expect(round2(-0.5)).toBe(-0.5);
    expect(round2(-2.675)).toBe(-2.67);
  });
});

describe('pyTitle — str.title() parity for heatmap labels', () => {
  it('matches the monolith label strings', () => {
    expect(pyTitle('ph')).toBe('Ph');
    expect(pyTitle('dissolved oxygen')).toBe('Dissolved Oxygen');
    expect(pyTitle('temperature')).toBe('Temperature');
    expect(pyTitle('turbidity')).toBe('Turbidity');
  });

  it('capitalizes after non-letters like Python', () => {
    expect(pyTitle('abc3de')).toBe('Abc3De');
    expect(pyTitle('TOTAL vibrio')).toBe('Total Vibrio');
  });
});

describe('pearson — statistics.correlation parity', () => {
  it('computes the worked oracle from the parity spec', () => {
    // temp=[28,29,27], ph=[7.8,7.9,8.0] -> r = -0.5
    expect(round2(pearson([28, 29, 27], [7.8, 7.9, 8.0]))).toBe(-0.5);
  });

  it('throws on zero variance (caller maps to 0.0)', () => {
    expect(() => pearson([5, 5, 5], [1, 2, 3])).toThrow();
  });
});

describe('mean', () => {
  it('matches statistics.mean for the oracle buckets', () => {
    expect(mean([28.0, 29.0])).toBe(28.5);
    expect(round2(mean([7.8, 7.9]))).toBe(7.85);
  });
});
