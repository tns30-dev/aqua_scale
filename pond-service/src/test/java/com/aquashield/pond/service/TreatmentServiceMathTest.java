package com.aquashield.pond.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class TreatmentServiceMathTest {

  @Test
  void courseCost_convertsGramsToKilograms() {
    assertThat(TreatmentService.courseCost(
        new BigDecimal("350"), "g", new BigDecimal("85.00"), "kg"))
        .isEqualByComparingTo("29.75");
  }

  @Test
  void courseCost_convertsMillilitresToLitres() {
    assertThat(TreatmentService.courseCost(
        new BigDecimal("2500"), "ml", new BigDecimal("12.50"), "l"))
        .isEqualByComparingTo("31.25");
  }

  @Test
  void courseCost_returnsNullForIncompleteOrMismatchedDose() {
    assertThat(TreatmentService.courseCost(null, "kg", new BigDecimal("12.00"), "kg")).isNull();
    assertThat(TreatmentService.courseCost(
        new BigDecimal("2"), "l", new BigDecimal("12.00"), "kg")).isNull();
    assertThat(TreatmentService.courseCost(
        new BigDecimal("2"), "kg", BigDecimal.ZERO, "kg")).isNull();
  }
}
