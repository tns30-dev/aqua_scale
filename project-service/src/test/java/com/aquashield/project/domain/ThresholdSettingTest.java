package com.aquashield.project.domain;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** PARITY ORACLES for threshold semantics (module_project ProjectParameterSetting). */
class ThresholdSettingTest {

  private static ParameterType param(String code, String name) {
    ParameterType p = new ParameterType();
    ReflectionTestUtils.setField(p, "parameterCode", code);
    ReflectionTestUtils.setField(p, "parameterName", name);
    return p;
  }

  private static ProjectParameterSetting setting(Double min, Double max) {
    return new ProjectParameterSetting(UUID.randomUUID(), param("ph", "pH"), min, max, false);
  }

  // Oracle #6 — inclusive bounds; NULL side skipped
  @Test
  void withinThreshold() {
    assertThat(setting(6.5, 9.0).isWithinThreshold(7.0)).isTrue();
    assertThat(setting(6.5, 9.0).isWithinThreshold(6.5)).isTrue();   // inclusive
    assertThat(setting(6.5, 9.0).isWithinThreshold(9.0)).isTrue();   // inclusive
    assertThat(setting(6.5, 9.0).isWithinThreshold(5.0)).isFalse();
    assertThat(setting(null, 9.0).isWithinThreshold(4.0)).isTrue();  // min side skipped
    assertThat(setting(6.5, null).isWithinThreshold(100.0)).isTrue(); // max side skipped
  }

  // Oracle #7 — violation message; within range → null
  @Test
  void violationMessage() {
    assertThat(setting(null, 9.0).getViolationMessage(10)).isEqualTo("ph above maximum: 10 > 9");
    assertThat(setting(6.5, 9.0).getViolationMessage(7.0)).isNull();
    assertThat(setting(6.5, null).getViolationMessage(5.0)).isEqualTo("ph below minimum: 5 < 6.5");
  }

  // Oracle #8 — THE ALIAS: threshold map key is parameter_code, never the display name
  @Test
  void thresholdKey_isCode_notDisplayName() {
    ParameterType p = param("ph", "pH");
    assertThat(p.thresholdKey()).isEqualTo("ph");
    assertThat(p.thresholdKey()).isNotEqualTo(p.getParameterName());
  }
}
