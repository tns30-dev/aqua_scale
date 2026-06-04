package com.aquashield.project.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/** PARITY ORACLES for ProfileType stage logic (module_project models.py get_stages etc.). */
class ProfileTypeStagesTest {

  private static final ObjectMapper M = new ObjectMapper();

  private static ProfileType withConfig(String json) throws Exception {
    ProfileType p = new ProfileType();
    ReflectionTestUtils.setField(p, "stageConfig", json == null ? null : M.readTree(json));
    return p;
  }

  private static final String SHRIMP = """
      [{"name":"Post-Larvae Stocking","startDay":1,"endDay":30},
       {"name":"Growth Phase","startDay":31,"endDay":60},
       {"name":"Pre-Harvest","startDay":61,"endDay":90}]""";

  // Oracle #1 — plain list returned verbatim
  @Test
  void stages_plainList() throws Exception {
    assertThat(withConfig(SHRIMP).getStages()).hasSize(3);
  }

  // Oracle #2 — wrapped dict returns inner stages
  @Test
  void stages_wrappedDict() throws Exception {
    ProfileType p = withConfig(
        "{\"stages\":[{\"name\":\"A\",\"startDay\":1,\"endDay\":90}],\"cycleLengthDays\":90}");
    assertThat(p.getStages()).hasSize(1);
    assertThat(p.getStages().get(0).get("name").asText()).isEqualTo("A");
  }

  // Oracle #3 — null/garbage → []
  @Test
  void stages_nullAndGarbage() throws Exception {
    assertThat(withConfig(null).getStages()).isEmpty();
    assertThat(withConfig("\"garbage\"").getStages()).isEmpty();
    assertThat(withConfig("{\"foo\":1}").getStages()).isEmpty();
    assertThat(withConfig("[]").getStages()).isEmpty();
  }

  // Oracle #4 — stage by day; out of range → null
  @Test
  void stageByDay() throws Exception {
    ProfileType p = withConfig(SHRIMP);
    assertThat(p.getStageByDay(45).get("name").asText()).isEqualTo("Growth Phase");
    assertThat(p.getStageByDay(1).get("name").asText()).isEqualTo("Post-Larvae Stocking");
    assertThat(p.getStageByDay(90).get("name").asText()).isEqualTo("Pre-Harvest");
    assertThat(p.getStageByDay(200)).isNull();
  }

  // Oracle #5 — cycle length = max endDay; [] → 0
  @Test
  void cycleLength() throws Exception {
    assertThat(withConfig(SHRIMP).getCycleLength()).isEqualTo(90);
    assertThat(withConfig("[]").getCycleLength()).isZero();
  }
}
