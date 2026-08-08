package com.aquashield.pond.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DailyHealthServiceTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void deriveStatus_matchesDailyHealthThresholds() {
    assertThat(DailyHealthService.deriveStatus(3, 0)).isEqualTo("poor");
    assertThat(DailyHealthService.deriveStatus(2, 10)).isEqualTo("fair");
    assertThat(DailyHealthService.deriveStatus(1, 0)).isEqualTo("good");
    assertThat(DailyHealthService.deriveStatus(0, 2)).isEqualTo("good");
    assertThat(DailyHealthService.deriveStatus(0, 1)).isEqualTo("excellent");
  }

  @Test
  void dayNumberCap_usesStageEndDaysWithDatabaseCap() throws Exception {
    StageResolver.ProjectContext context = new StageResolver.ProjectContext(
        null,
        null,
        List.of(stage(1, 60), stage(61, 250)),
        null);

    assertThat(DailyHealthService.dayNumberCap(context)).isEqualTo(200);
  }

  @Test
  void dayNumberCap_fallsBackToDatabaseCapWithoutValidStages() {
    StageResolver.ProjectContext context = new StageResolver.ProjectContext(
        null,
        null,
        List.of(),
        120);

    assertThat(DailyHealthService.dayNumberCap(context)).isEqualTo(200);
  }

  private JsonNode stage(int startDay, int endDay) throws Exception {
    return mapper.readTree("""
        {"name":"Stage","startDay":%d,"endDay":%d}
        """.formatted(startDay, endDay));
  }
}
