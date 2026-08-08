package com.aquashield.pond.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class FeedingServiceMathTest {

  @Test
  void unitPrice_roundsToFourDecimals() {
    assertThat(FeedingService.unitPrice(new BigDecimal("7.00"), new BigDecimal("10.00")))
        .isEqualByComparingTo("1.4286");
  }

  @Test
  void rowCost_usesFrozenPackSnapshotAndRoundsToCents() {
    assertThat(FeedingService.rowCost(
        new BigDecimal("12.50"), new BigDecimal("25.00"), new BigDecimal("62.50")))
        .isEqualByComparingTo("31.25");
  }

  @Test
  void percentChange_returnsNullForMissingOrZeroCompare() {
    assertThat(FeedingService.pct(new BigDecimal("10.00"), BigDecimal.ZERO)).isNull();
    assertThat(FeedingService.pct(new BigDecimal("12.00"), new BigDecimal("10.00")))
        .isEqualTo(20.0);
  }
}
