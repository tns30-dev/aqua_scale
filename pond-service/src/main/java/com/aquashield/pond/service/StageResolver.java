package com.aquashield.pond.service;

import com.aquashield.api.project.v1.GetProfileTypeRequest;
import com.aquashield.api.project.v1.GetProjectRequest;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Profile stage resolution via Project Service gRPC (the monolith walked
 * pond→project→profile_type in-process). PARITY (get_stages/get_stage_by_day): the
 * stage_config supports a plain list OR {"stages":[...]} wrapper; inner keys are
 * camelCase startDay/endDay; first stage with startDay <= day <= endDay wins.
 * Lookup failures degrade to "no stages" (stage names omitted) — stage labels are
 * decoration, never a write-path dependency here.
 */
@Service
public class StageResolver {

  public record ProjectContext(
      String projectName, String profileTypeCode, List<JsonNode> stages, Integer cycleLengthDays) {
    public String stageNameForDay(int day) {
      for (JsonNode stage : stages) {
        JsonNode start = stage.get("startDay");
        JsonNode end = stage.get("endDay");
        if (start == null || end == null || !start.canConvertToInt() || !end.canConvertToInt()) {
          continue;
        }
        if (start.asInt() <= day && day <= end.asInt()) {
          return stage.path("name").asText(null);
        }
      }
      return null;
    }
  }

  record ParsedStageConfig(List<JsonNode> stages, Integer cycleLengthDays) {}

  private static final Logger log = LoggerFactory.getLogger(StageResolver.class);
  private static final ProjectContext EMPTY = new ProjectContext(null, null, List.of(), null);

  private final ProjectServiceGrpc.ProjectServiceBlockingStub project;
  private final ObjectMapper mapper;

  public StageResolver(ProjectServiceGrpc.ProjectServiceBlockingStub project, ObjectMapper mapper) {
    this.project = project;
    this.mapper = mapper;
  }

  public ProjectContext forProject(UUID projectId) {
    try {
      var proj = project.getProject(
          GetProjectRequest.newBuilder().setProjectId(projectId.toString()).build());
      var profile = project.getProfileType(
          GetProfileTypeRequest.newBuilder().setProfileTypeId(proj.getProfileTypeId()).build());
      ParsedStageConfig parsed = parseStageConfig(profile.getStageConfigJson());
      return new ProjectContext(proj.getName(), profile.getCode(), parsed.stages(),
          parsed.cycleLengthDays());
    } catch (Exception e) {
      log.debug("Project context lookup failed for {}: {}", projectId, e.toString());
      return EMPTY;
    }
  }

  /** PARITY (get_stages): null/garbage -> []; list -> as-is; {"stages":[...]} -> inner. */
  List<JsonNode> parseStages(String stageConfigJson) {
    return parseStageConfig(stageConfigJson).stages();
  }

  ParsedStageConfig parseStageConfig(String stageConfigJson) {
    if (stageConfigJson == null || stageConfigJson.isBlank()) {
      return new ParsedStageConfig(List.of(), null);
    }
    try {
      JsonNode config = mapper.readTree(stageConfigJson);
      Integer cycleLengthDays = config.isObject() && config.path("cycleLengthDays").canConvertToInt()
          ? config.path("cycleLengthDays").asInt() : null;
      JsonNode source = config.isArray() ? config
          : (config.isObject() && config.path("stages").isArray() ? config.get("stages") : null);
      if (source == null) {
        return new ParsedStageConfig(List.of(), cycleLengthDays);
      }
      List<JsonNode> stages = new ArrayList<>();
      source.forEach(stages::add);
      return new ParsedStageConfig(stages, cycleLengthDays);
    } catch (Exception e) {
      return new ParsedStageConfig(List.of(), null);
    }
  }
}
