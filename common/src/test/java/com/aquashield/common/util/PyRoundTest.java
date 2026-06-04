package com.aquashield.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Oracles cross-checked against CPython 3.12 round(). */
class PyRoundTest {

  @Test
  void matchesCpythonRoundHalfEven() {
    assertThat(PyRound.round(2.675, 2)).isEqualTo(2.67);   // binary below midpoint
    assertThat(PyRound.round(0.125, 2)).isEqualTo(0.12);   // true tie -> even
    assertThat(PyRound.round(0.375, 2)).isEqualTo(0.38);   // true tie -> even
    assertThat(PyRound.round(0.135, 2)).isEqualTo(0.14);   // binary above midpoint
    assertThat(PyRound.round(28.456, 2)).isEqualTo(28.46);
    assertThat(PyRound.round(-2.675, 2)).isEqualTo(-2.67);
    assertThat(PyRound.round(3.0, 3)).isEqualTo(3.0);
    assertThat(PyRound.round(0.125, 2)).isEqualTo(0.12);
    assertThat(PyRound.round(3.0 / 24, 2)).isEqualTo(0.12); // energy oracle: 0.125 -> 0.12
  }

  @Test
  void intRoundIsBankers() {
    assertThat(PyRound.round(37.5)).isEqualTo(38);   // even
    assertThat(PyRound.round(-62.5)).isEqualTo(-62); // even
    assertThat(PyRound.round(2.5)).isEqualTo(2);     // even (Math.round would say 3)
    assertThat(PyRound.round(-33.333333333333336)).isEqualTo(-33);
  }
}
