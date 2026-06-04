package com.aquashield.identity.service;

import com.aquashield.identity.domain.FeatureActionEntry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** PARITY ORACLES for module_user/validators.py (structural rules only). */
class FeatureActionValidatorTest {

  private final FeatureActionValidator validator = new FeatureActionValidator();

  @Test
  void acceptsValidEntries() {
    assertThatCode(() -> validator.validate(List.of(
        new FeatureActionEntry("overview", List.of()),
        new FeatureActionEntry("realtime_forecast", List.of("ai_forecast"))))).doesNotThrowAnyException();
  }

  @Test
  void acceptsWildcardSentinel() {
    assertThatCode(() -> validator.validate(List.of(FeatureActionEntry.wildcard())))
        .doesNotThrowAnyException();
    assertThatCode(() -> validator.validate(List.of(new FeatureActionEntry("*", List.of()))))
        .doesNotThrowAnyException();
  }

  // Oracle #23 — exact duplicate-code message
  @Test
  void rejectsDuplicateFeatureCodes() {
    assertThatThrownBy(() -> validator.validate(List.of(
        new FeatureActionEntry("overview", List.of()),
        new FeatureActionEntry("overview", List.of()))))
        .hasMessage("Duplicate feature_access code 'overview'.");
  }

  @Test
  void rejectsWildcardFeatureWithSpecificActions() {
    assertThatThrownBy(() -> validator.validate(List.of(
        new FeatureActionEntry("*", List.of("export_data")))))
        .isInstanceOf(FeatureActionValidator.InvalidFeatureActionException.class);
  }

  @Test
  void rejectsWildcardMixedWithSpecificActions() {
    assertThatThrownBy(() -> validator.validate(List.of(
        new FeatureActionEntry("historical_data", List.of("*", "export_data")))))
        .isInstanceOf(FeatureActionValidator.InvalidFeatureActionException.class);
  }

  @Test
  void rejectsBlankFeatureCode() {
    assertThatThrownBy(() -> validator.validate(List.of(
        new FeatureActionEntry(" ", List.of()))))
        .isInstanceOf(FeatureActionValidator.InvalidFeatureActionException.class);
  }
}
