package com.aquashield.pond.service;

import com.aquashield.pond.api.dto.PondDtos.CreatePondRequest;
import com.aquashield.pond.api.dto.PondDtos.CycleDto;
import com.aquashield.pond.api.dto.PondDtos.PondDto;
import com.aquashield.pond.api.dto.PondDtos.StartCycleRequest;
import com.aquashield.pond.api.dto.PondDtos.UpdateCycleRequest;
import com.aquashield.pond.api.dto.PondDtos.UpdatePondRequest;
import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.CycleDailyHealth;
import com.aquashield.pond.domain.Entities.CycleStageMetric;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.events.PondEventPublisher;
import com.aquashield.pond.repo.Repos.CycleDailyHealthRepository;
import com.aquashield.pond.repo.Repos.CycleRepository;
import com.aquashield.pond.repo.Repos.CycleStageMetricRepository;
import com.aquashield.pond.repo.Repos.PondRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Pond/cycle application logic (spec: main/pond_service.md; parity per agent spec). */
@Service
public class PondAppService {

  private final PondRepository ponds;
  private final CycleRepository cycles;
  private final CycleDailyHealthRepository dailyHealth;
  private final CycleStageMetricRepository stageMetrics;
  private final StageResolver stageResolver;
  private final PondEventPublisher events;
  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;

  public PondAppService(PondRepository ponds, CycleRepository cycles,
                        CycleDailyHealthRepository dailyHealth,
                        CycleStageMetricRepository stageMetrics, StageResolver stageResolver,
                        PondEventPublisher events, StringRedisTemplate redis,
                        ObjectMapper mapper) {
    this.ponds = ponds;
    this.cycles = cycles;
    this.dailyHealth = dailyHealth;
    this.stageMetrics = stageMetrics;
    this.stageResolver = stageResolver;
    this.events = events;
    this.redis = redis;
    this.mapper = mapper;
  }

  // ---------- ponds ----------

  /** PARITY: {"ponds":[snake]} wrapped, name-ordered; project/profile names via gRPC. */
  @Transactional(readOnly = true)
  public Map<String, Object> listPonds(UUID projectId) {
    var context = stageResolver.forProject(projectId);
    List<PondDto> list = ponds.findByProjectIdOrderByNameAsc(projectId).stream()
        .map(p -> PondDto.from(p, context.projectName(), context.profileTypeCode()))
        .toList();
    return Map.of("ponds", list);
  }

  @Transactional(readOnly = true)
  public PondDto getPond(UUID pondId, boolean memberOfProject) {
    Pond pond = requirePond(pondId);
    if (!memberOfProject) {
      throw new NotFound(); // caller checks membership against pond.projectId
    }
    var context = stageResolver.forProject(pond.getProjectId());
    return PondDto.from(pond, context.projectName(), context.profileTypeCode());
  }

  public Pond requirePond(UUID pondId) {
    return ponds.findById(pondId).orElseThrow(NotFound::new);
  }

  @Transactional
  public PondDto createPond(UUID projectId, CreatePondRequest req) {
    Pond pond = new Pond();
    pond.setProjectId(projectId);
    pond.setName(req.name());
    pond.setDescription(req.description());
    pond.setMetadata(req.metadata() != null ? req.metadata() : mapper.createObjectNode());
    if (req.status() != null) {
      requireValidStatus(req.status(), Pond.STATUSES);
      pond.setStatus(req.status());
    }
    pond.setPhotoUrl(req.photoUrl());
    pond = ponds.save(pond);
    invalidatePondList(projectId);
    events.publish(PondEventPublisher.TOPIC_POND_CREATED, projectId,
        mapper.createObjectNode().put("pondId", pond.getPondId().toString()));
    var context = stageResolver.forProject(projectId);
    return PondDto.from(pond, context.projectName(), context.profileTypeCode());
  }

  @Transactional
  public PondDto updatePond(UUID pondId, UpdatePondRequest req) {
    Pond pond = requirePond(pondId);
    if (req.name() != null && !req.name().isBlank()) {
      pond.setName(req.name());
    }
    if (req.description() != null) {
      pond.setDescription(req.description());
    }
    if (req.metadata() != null) {
      pond.setMetadata(req.metadata());
    }
    if (req.status() != null) {
      requireValidStatus(req.status(), Pond.STATUSES);
      pond.setStatus(req.status());
    }
    if (req.photoUrl() != null) {
      pond.setPhotoUrl(req.photoUrl());
    }
    invalidatePondList(pond.getProjectId());
    events.publish(PondEventPublisher.TOPIC_POND_UPDATED, pond.getProjectId(),
        mapper.createObjectNode().put("pondId", pondId.toString()));
    var context = stageResolver.forProject(pond.getProjectId());
    return PondDto.from(pond, context.projectName(), context.profileTypeCode());
  }

  // ---------- cycles ----------

  /** PARITY: DRF-paginated envelope shape {count, next, previous, results}. */
  @Transactional(readOnly = true)
  public Map<String, Object> listCycles(UUID pondId, boolean memberOfProject) {
    Pond pond = requirePond(pondId);
    if (!memberOfProject) {
      throw new NotFound();
    }
    LocalDate today = LocalDate.now();
    List<CycleDto> results = cycles.findByPondIdOrderByStartDateDesc(pondId).stream()
        .map(c -> CycleDto.from(c, pond.getName(), today))
        .toList();
    Map<String, Object> envelope = new LinkedHashMap<>();
    envelope.put("count", results.size());
    envelope.put("next", null);
    envelope.put("previous", null);
    envelope.put("results", results);
    return envelope;
  }

  /**
   * NET-NEW write (monolith was admin-only). PARITY-preserved looseness: NO
   * one-ongoing-cycle constraint (the monolith never enforced one).
   */
  @Transactional
  public CycleDto startCycle(UUID pondId, StartCycleRequest req, UUID actingUserId) {
    Pond pond = requirePond(pondId);
    String status = req.status() != null ? req.status() : "ongoing";
    requireValidStatus(status, Cycle.STATUSES);
    Cycle cycle = cycles.save(new Cycle(pondId, req.startDate(), status, actingUserId));
    events.publish(PondEventPublisher.TOPIC_CYCLE_STARTED, pond.getProjectId(),
        mapper.createObjectNode().put("cycleId", cycle.getCycleId().toString())
            .put("pondId", pondId.toString()));
    return CycleDto.from(cycle, pond.getName(), LocalDate.now());
  }

  @Transactional
  public CycleDto updateCycle(UUID cycleId, UpdateCycleRequest req, UUID actingUserId) {
    Cycle cycle = cycles.findById(cycleId).orElseThrow(NotFound::new);
    Pond pond = requirePond(cycle.getPondId());
    boolean completed = false;
    if (req.status() != null) {
      requireValidStatus(req.status(), Cycle.STATUSES);
      completed = "completed".equals(req.status()) && cycle.isOngoing();
      cycle.setStatus(req.status());
    }
    if (req.endDate() != null) {
      cycle.setEndDate(req.endDate());
    }
    cycle.setUpdatedBy(actingUserId);
    if (completed) {
      events.publish(PondEventPublisher.TOPIC_CYCLE_COMPLETED, pond.getProjectId(),
          mapper.createObjectNode().put("cycleId", cycleId.toString())
              .put("pondId", pond.getPondId().toString()));
    }
    return CycleDto.from(cycle, pond.getName(), LocalDate.now());
  }

  /**
   * PARITY (/cycles/{id}/details): camelCase composition —
   * cycle {cycleId,pondId,pondName,startDate,endDate,status,displayName} ·
   * stageMetrics {stageName: {param: {current,min,max}}} (JSONB avg -> current) ·
   * dailyHealth [{dayNumber,date,healthStatus,alertCount,stageName}] (stage by day).
   */
  @Transactional(readOnly = true)
  public Map<String, Object> cycleDetails(UUID cycleId, boolean memberCheck) {
    Cycle cycle = cycles.findById(cycleId).orElseThrow(NotFound::new);
    Pond pond = requirePond(cycle.getPondId());
    if (!memberCheck) {
      throw new NotFound();
    }
    var context = stageResolver.forProject(pond.getProjectId());

    Map<String, Object> cycleBlock = new LinkedHashMap<>();
    cycleBlock.put("cycleId", cycle.getCycleId().toString());
    cycleBlock.put("pondId", pond.getPondId().toString());
    cycleBlock.put("pondName", pond.getName());
    cycleBlock.put("startDate", cycle.getStartDate().toString());
    cycleBlock.put("endDate", cycle.getEndDate() == null ? null : cycle.getEndDate().toString());
    cycleBlock.put("status", cycle.getStatus());
    cycleBlock.put("displayName", cycle.displayName());

    Map<String, Object> stageBlock = new LinkedHashMap<>();
    for (CycleStageMetric metric : stageMetrics.findByCycleIdOrderByStageNameAsc(cycleId)) {
      Map<String, Object> params = new LinkedHashMap<>();
      JsonNode metrics = metric.getMetrics();
      if (metrics != null && metrics.isObject()) {
        metrics.properties().forEach(e -> {
          // PARITY: avg flattened to "current"
          Map<String, Object> values = new LinkedHashMap<>();
          values.put("current", e.getValue().path("avg").asDouble());
          values.put("min", e.getValue().path("min").asDouble());
          values.put("max", e.getValue().path("max").asDouble());
          params.put(e.getKey(), values);
        });
      }
      stageBlock.put(metric.getStageName(), params);
    }

    List<Map<String, Object>> healthBlock = new ArrayList<>();
    for (CycleDailyHealth h : dailyHealth.findByCycleIdOrderByDayNumberAsc(cycleId)) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("dayNumber", h.getDayNumber());
      row.put("date", h.getDate().toString());
      row.put("healthStatus", h.getHealthStatus());
      row.put("alertCount", h.getAlertCount());
      row.put("stageName", context.stageNameForDay(h.getDayNumber()));
      healthBlock.add(row);
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("cycle", cycleBlock);
    body.put("stageMetrics", stageBlock);
    body.put("dailyHealth", healthBlock);
    return body;
  }

  /** Membership helper: resolve cycle -> pond -> projectId (404 when either missing). */
  @Transactional(readOnly = true)
  public UUID cycleProjectId(UUID cycleId) {
    Cycle cycle = cycles.findById(cycleId).orElseThrow(NotFound::new);
    return requirePond(cycle.getPondId()).getProjectId();
  }

  private void invalidatePondList(UUID projectId) {
    redis.delete("pond:list:" + projectId);
  }

  private static void requireValidStatus(String status, java.util.Set<String> allowed) {
    if (!allowed.contains(status)) {
      throw new BadRequest("Invalid status. Must be one of: " + String.join(", ",
          allowed.stream().sorted().toList()));
    }
  }

  public static class NotFound extends RuntimeException {}

  public static class BadRequest extends RuntimeException {
    public BadRequest(String message) {
      super(message);
    }
  }
}
