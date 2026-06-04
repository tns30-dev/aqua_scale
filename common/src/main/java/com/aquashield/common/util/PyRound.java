package com.aquashield.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * CPython round() parity: round-half-to-even evaluated on the EXACT binary value of the
 * double. `new BigDecimal(double)` (not valueOf!) reproduces that exactly:
 * round(2.675, 2) == 2.67 (stored below the midpoint), round(0.125, 2) == 0.12 (true
 * tie -> even). Java's Math.round / BigDecimal.valueOf would both diverge.
 */
public final class PyRound {

  private PyRound() {}

  public static double round(double value, int digits) {
    if (Double.isNaN(value) || Double.isInfinite(value)) {
      return value;
    }
    return new BigDecimal(value).setScale(digits, RoundingMode.HALF_EVEN).doubleValue();
  }

  /** round(x) with ndigits omitted -> int (banker's). */
  public static long round(double value) {
    return new BigDecimal(value).setScale(0, RoundingMode.HALF_EVEN).longValueExact();
  }
}
