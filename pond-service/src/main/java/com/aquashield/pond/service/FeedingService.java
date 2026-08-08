package com.aquashield.pond.service;

import com.aquashield.common.util.PyRound;
import com.aquashield.pond.api.dto.PondDtos.CreateFeedTypeRequest;
import com.aquashield.pond.api.dto.PondDtos.CycleBiomassRequest;
import com.aquashield.pond.api.dto.PondDtos.FeedDayWriteRequest;
import com.aquashield.pond.api.dto.PondDtos.FeedEntryWrite;
import com.aquashield.pond.api.dto.PondDtos.FeedTypeRecordDto;
import com.aquashield.pond.api.dto.PondDtos.UpdateFeedTypeRequest;
import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.FeedLog;
import com.aquashield.pond.domain.Entities.FeedType;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.repo.Repos.CycleRepository;
import com.aquashield.pond.repo.Repos.FeedLogRepository;
import com.aquashield.pond.repo.Repos.FeedTypeRepository;
import com.aquashield.pond.repo.Repos.PondRepository;
import com.aquashield.pond.repo.Repos.PondTreatmentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class FeedingService {

  static final List<String> STAGE_PALETTE = List.of(
      "#0D9488", "#2563EB", "#D97706", "#7C3AED", "#DC2626", "#0891B2");
  private static final BigDecimal ZERO = BigDecimal.ZERO;
  private static final DateTimeFormatter FEED_TIME = DateTimeFormatter.ofPattern("HH:mm");

  private final PondRepository ponds;
  private final CycleRepository cycles;
  private final FeedTypeRepository feedTypes;
  private final FeedLogRepository feedLogs;
  private final PondTreatmentRepository pondTreatments;
  private final StageResolver stageResolver;

  public FeedingService(PondRepository ponds, CycleRepository cycles,
                        FeedTypeRepository feedTypes, FeedLogRepository feedLogs,
                        PondTreatmentRepository pondTreatments, StageResolver stageResolver) {
    this.ponds = ponds;
    this.cycles = cycles;
    this.feedTypes = feedTypes;
    this.feedLogs = feedLogs;
    this.pondTreatments = pondTreatments;
    this.stageResolver = stageResolver;
  }

  static BigDecimal unitPrice(BigDecimal packKg, BigDecimal packPrice) {
    return packPrice.divide(packKg, 4, RoundingMode.HALF_UP);
  }

  static BigDecimal rowCost(BigDecimal amountKg, BigDecimal packKg, BigDecimal packPrice) {
    return amountKg.multiply(packPrice).divide(packKg, 2, RoundingMode.HALF_UP);
  }

  static Double pct(BigDecimal a, BigDecimal b) {
    if (a == null || b == null || b.compareTo(ZERO) == 0) {
      return null;
    }
    return PyRound.round(a.subtract(b).divide(b, 12, RoundingMode.HALF_UP)
        .multiply(BigDecimal.valueOf(100)).doubleValue(), 1);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> options(UUID projectId) {
    LocalDate today = LocalDate.now();
    List<Pond> pondList = ponds.findByProjectIdOrderByNameAsc(projectId);
    List<UUID> pondIds = pondList.stream().map(Pond::getPondId).toList();
    Map<String, List<FeedLog>> logsByPondDay = new HashMap<>();
    if (!pondIds.isEmpty()) {
      for (FeedLog row : feedLogs.findByPondIdIn(pondIds)) {
        logsByPondDay.computeIfAbsent(row.getPondId() + "|" + row.getFedOn(), k -> new ArrayList<>())
            .add(row);
      }
    }

    List<Map<String, Object>> pondJson = new ArrayList<>();
    for (Pond pond : pondList) {
      List<Map<String, Object>> cycleJson = new ArrayList<>();
      for (Cycle cycle : cycles.findByPondIdOrderByStartDateAsc(pond.getPondId())) {
        int elapsed = elapsedDays(cycle, today);
        BigDecimal feed = ZERO;
        BigDecimal cost = ZERO;
        for (int offset = 0; offset < elapsed; offset++) {
          LocalDate day = cycle.getStartDate().plusDays(offset);
          for (FeedLog row : logsByPondDay.getOrDefault(pond.getPondId() + "|" + day, List.of())) {
            feed = feed.add(row.getAmountKg());
            cost = cost.add(rowCost(row.getAmountKg(), row.getPackKg(), row.getPackPrice()));
          }
        }
        BigDecimal gain = biomassGain(cycle);
        BigDecimal fcr = gain != null && gain.compareTo(ZERO) > 0
            ? feed.divide(gain, 2, RoundingMode.HALF_UP) : null;
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("cycleId", cycle.getCycleId().toString());
        entry.put("displayName", displayName(cycle));
        entry.put("startDate", cycle.getStartDate().toString());
        entry.put("endDate", cycle.getEndDate() == null ? null : cycle.getEndDate().toString());
        entry.put("status", cycle.getStatus());
        entry.put("elapsedDays", elapsed);
        entry.put("feedKg", feed);
        entry.put("cost", cost);
        entry.put("fcr", fcr);
        entry.put("biomassGainKg", gain);
        cycleJson.add(entry);
      }
      Map<String, Object> pondEntry = new LinkedHashMap<>();
      pondEntry.put("pondId", pond.getPondId().toString());
      pondEntry.put("name", pond.getName());
      pondEntry.put("cycles", cycleJson);
      pondJson.add(pondEntry);
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("projectId", projectId.toString());
    body.put("ponds", pondJson);
    body.put("feedTypes", feedTypes.findByProjectIdAndActiveTrueOrderByNameAsc(projectId).stream()
        .map(this::feedTypeOption).toList());
    return body;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> dashboard(UUID projectId, UUID cycleId, UUID compareCycleId) {
    Cycle cycle = cycleInProject(cycleId, projectId, "Cycle not found in this project");
    Cycle compare = compareCycleId == null ? null
        : cycleInProject(compareCycleId, projectId, "Compare cycle not found in this project");
    return dashboard(projectId, cycle, compare);
  }

  @Transactional
  public void saveFeedDay(Pond pond, LocalDate fedOn, FeedDayWriteRequest req, UUID actingUserId) {
    if (fedOn.isAfter(LocalDate.now()) && !isInsideCurrentCyclePlan(pond, fedOn)) {
      throw new PondAppService.BadRequest("This day is beyond the current cycle plan.");
    }

    Map<UUID, FeedType> feedTypesById = new HashMap<>();
    for (FeedType ft : feedTypes.findByProjectIdOrderByNameAsc(pond.getProjectId())) {
      feedTypesById.put(ft.getFeedTypeId(), ft);
    }
    Map<UUID, FeedLog> existing = new HashMap<>();
    for (FeedLog row : feedLogs.findByPondIdAndFedOnOrderByCreatedAtAsc(pond.getPondId(), fedOn)) {
      existing.put(row.getFeedLogId(), row);
    }

    Set<UUID> keep = new HashSet<>();
    List<FeedEntryWrite> entries = req.entries() == null ? List.of() : req.entries();
    for (FeedEntryWrite entry : entries) {
      FeedType feedType = feedTypesById.get(entry.feedTypeId());
      if (feedType == null) {
        throw new PondAppService.BadRequest("Feed type not found in this project.");
      }

      if (entry.feedLogId() != null) {
        FeedLog row = existing.get(entry.feedLogId());
        if (row == null) {
          throw new PondAppService.BadRequest("feedLogId does not belong to this pond and day.");
        }
        keep.add(entry.feedLogId());
        if (!row.getFeedType().getFeedTypeId().equals(feedType.getFeedTypeId())) {
          if (!feedType.isActive()) {
            throw new PondAppService.BadRequest("Feed type \"" + feedType.getName()
                + "\" is inactive.");
          }
          row.snapshotPack(feedType);
        }
        row.setAmountKg(entry.amountKg());
        row.setFedTime(entry.fedTime());
        row.setUpdatedBy(actingUserId);
      } else {
        if (!feedType.isActive()) {
          throw new PondAppService.BadRequest("Feed type \"" + feedType.getName()
              + "\" is inactive.");
        }
        feedLogs.save(new FeedLog(pond.getPondId(), feedType, fedOn, entry.fedTime(),
            entry.amountKg(), actingUserId));
      }
    }

    for (FeedLog row : existing.values()) {
      if (!keep.contains(row.getFeedLogId())) {
        feedLogs.delete(row);
      }
    }
  }

  @Transactional(readOnly = true)
  public List<FeedTypeRecordDto> listFeedTypes(UUID projectId) {
    return feedTypes.findByProjectIdOrderByNameAsc(projectId).stream()
        .map(FeedTypeRecordDto::from).toList();
  }

  @Transactional
  public FeedTypeRecordDto createFeedType(CreateFeedTypeRequest req, UUID actingUserId) {
    if (feedTypes.findByProjectIdAndName(req.projectId(), req.name()).isPresent()) {
      throw new PondAppService.BadRequest("A feed type with this name already exists");
    }
    FeedType created = feedTypes.saveAndFlush(new FeedType(req.projectId(), req.name(), req.packKg(),
        req.packPrice(), req.currency(), actingUserId));
    return FeedTypeRecordDto.from(created);
  }

  @Transactional
  public FeedTypeRecordDto updateFeedType(UUID feedTypeId, UpdateFeedTypeRequest req,
                                          UUID actingUserId) {
    FeedType ft = feedTypes.findById(feedTypeId).orElseThrow(PondAppService.NotFound::new);
    if (req.name() != null && !req.name().isBlank()) {
      if (feedTypes.existsByProjectIdAndNameAndFeedTypeIdNot(
          ft.getProjectId(), req.name(), feedTypeId)) {
        throw new PondAppService.BadRequest("A feed type with this name already exists");
      }
      ft.setName(req.name());
    }
    if (req.packKg() != null) {
      ft.setPackKg(req.packKg());
    }
    if (req.packPrice() != null) {
      ft.setPackPrice(req.packPrice());
    }
    if (req.currency() != null && !req.currency().isBlank()) {
      ft.setCurrency(req.currency());
    }
    if (req.active() != null) {
      ft.setActive(req.active());
    }
    ft.setUpdatedBy(actingUserId);
    return FeedTypeRecordDto.from(feedTypes.saveAndFlush(ft));
  }

  @Transactional
  public void deleteFeedType(UUID feedTypeId) {
    FeedType ft = feedTypes.findById(feedTypeId).orElseThrow(PondAppService.NotFound::new);
    if (feedLogs.countByFeedTypeFeedTypeId(feedTypeId) > 0) {
      throw new PondAppService.BadRequest(
          "This feed type is already used by feed logs. Retire it instead.");
    }
    feedTypes.delete(ft);
  }

  @Transactional
  public void saveCycleBiomass(UUID cycleId, CycleBiomassRequest req, UUID actingUserId) {
    if (req.stockingBiomassKg() == null && req.harvestBiomassKg() == null) {
      throw new PondAppService.BadRequest("Provide stockingBiomassKg and/or harvestBiomassKg.");
    }
    Cycle cycle = cycles.findById(cycleId).orElseThrow(PondAppService.NotFound::new);
    if (req.harvestBiomassKg() != null && cycle.isOngoing()) {
      throw new PondAppService.BadRequest(
          "Harvest biomass can only be recorded once the cycle is finished.");
    }
    if (req.stockingBiomassKg() != null) {
      cycle.setStockingBiomassKg(req.stockingBiomassKg());
    }
    if (req.harvestBiomassKg() != null) {
      cycle.setHarvestBiomassKg(req.harvestBiomassKg());
    }
    cycle.setUpdatedBy(actingUserId);
  }

  public UUID feedTypeProjectId(UUID feedTypeId) {
    return feedTypes.findById(feedTypeId).orElseThrow(PondAppService.NotFound::new).getProjectId();
  }

  private Map<String, Object> dashboard(UUID projectId, Cycle cycle, Cycle compareCycle) {
    LocalDate today = LocalDate.now();
    Map<String, Object> template = template(projectId);
    int lengthDays = (int) template.get("lengthDays");
    int elapsed = elapsedDays(cycle, today);
    int axisLen = Math.max(lengthDays, elapsed);
    Map<Integer, List<FeedLog>> byDay = rowsByCycleDay(cycle, axisLen);

    Integer compareElapsed = null;
    Integer compareAxisLen = null;
    Map<Integer, List<FeedLog>> compareByDay = null;
    if (compareCycle != null) {
      compareElapsed = elapsedDays(compareCycle, today);
      compareAxisLen = Math.max(lengthDays, compareElapsed);
      compareByDay = rowsByCycleDay(compareCycle, compareAxisLen);
    }
    int horizon = compareElapsed == null ? elapsed : Math.min(elapsed, compareElapsed);

    Map<String, Object> baseKpis = kpis(cycle, byDay, horizon, elapsed);
    Map<String, Object> compareKpis = compareCycle == null ? null
        : kpis(compareCycle, compareByDay, horizon, compareElapsed);
    Map<String, Object> changes = compareKpis == null ? null : changes(baseKpis, compareKpis);

    Map<String, Object> kpis = new LinkedHashMap<>();
    kpis.put("base", baseKpis);
    kpis.put("compare", compareKpis);
    kpis.put("changes", changes);

    Map<String, Object> days = new LinkedHashMap<>();
    days.put("base", days(cycle, byDay, axisLen));
    days.put("compare", compareCycle == null ? null : days(compareCycle, compareByDay, compareAxisLen));

    Map<String, Object> stageSummaries = new LinkedHashMap<>();
    stageSummaries.put("base", stageSummaries(template, byDay, elapsed, compareByDay,
        compareElapsed));
    stageSummaries.put("compare", compareCycle == null ? null
        : stageSummaries(template, compareByDay, compareElapsed, null, null));

    Map<String, Object> treatments = new LinkedHashMap<>();
    treatments.put("base", treatments(cycle, axisLen));
    treatments.put("compare", compareCycle == null ? null : treatments(compareCycle, compareAxisLen));

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("template", template);
    body.put("cycle", cycleJson(cycle, elapsed));
    body.put("compare", compareCycle == null ? null : cycleJson(compareCycle, compareElapsed));
    body.put("horizonDays", horizon);
    body.put("kpis", kpis);
    body.put("days", days);
    body.put("stageSummaries", stageSummaries);
    body.put("treatments", treatments);
    return body;
  }

  private boolean isInsideCurrentCyclePlan(Pond pond, LocalDate fedOn) {
    return cycles.findFirstByPondIdAndStatusAndStartDateLessThanEqualOrderByStartDateDesc(
            pond.getPondId(), "ongoing", fedOn)
        .map(cycle -> {
          int axis = Math.max((int) template(pond.getProjectId()).get("lengthDays"),
              elapsedDays(cycle, LocalDate.now()));
          return !fedOn.isAfter(cycle.getStartDate().plusDays(axis - 1L));
        })
        .orElse(false);
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> stages(Map<String, Object> template) {
    return (List<Map<String, Object>>) template.get("stages");
  }

  private Map<String, Object> template(UUID projectId) {
    var context = stageResolver.forProject(projectId);
    List<Map<String, Object>> stages = new ArrayList<>();
    int maxDay = 0;
    for (int i = 0; i < context.stages().size(); i++) {
      JsonNode stage = context.stages().get(i);
      JsonNode start = stage.get("startDay");
      JsonNode end = stage.get("endDay");
      if (start == null || end == null || !start.canConvertToInt() || !end.canConvertToInt()) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("name", stage.path("name").asText(null));
      row.put("startDay", start.asInt());
      row.put("endDay", end.asInt());
      row.put("color", STAGE_PALETTE.get(i % STAGE_PALETTE.size()));
      stages.add(row);
      maxDay = Math.max(maxDay, end.asInt());
    }
    int length = context.cycleLengthDays() != null && context.cycleLengthDays() > 0
        ? context.cycleLengthDays() : Math.max(maxDay, 30);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("lengthDays", length);
    body.put("stages", stages);
    return body;
  }

  private Cycle cycleInProject(UUID cycleId, UUID projectId, String error) {
    Cycle cycle = cycles.findById(cycleId).orElseThrow(() -> new NotFoundDetail(error));
    Pond pond = ponds.findById(cycle.getPondId()).orElseThrow(() -> new NotFoundDetail(error));
    if (!pond.getProjectId().equals(projectId)) {
      throw new NotFoundDetail(error);
    }
    return cycle;
  }

  private Map<Integer, List<FeedLog>> rowsByCycleDay(Cycle cycle, int axisLen) {
    LocalDate start = cycle.getStartDate();
    LocalDate end = start.plusDays(axisLen - 1L);
    Map<Integer, List<FeedLog>> byDay = new HashMap<>();
    for (FeedLog row : feedLogs.findByPondIdAndFedOnBetweenOrderByFedOnAscCreatedAtAsc(
        cycle.getPondId(), start, end)) {
      int day = (int) (row.getFedOn().toEpochDay() - start.toEpochDay()) + 1;
      byDay.computeIfAbsent(day, k -> new ArrayList<>()).add(row);
    }
    return byDay;
  }

  private static int elapsedDays(Cycle cycle, LocalDate today) {
    LocalDate end = cycle.getEndDate() != null && !cycle.getEndDate().isAfter(today)
        ? cycle.getEndDate() : today;
    return Math.max((int) (end.toEpochDay() - cycle.getStartDate().toEpochDay()) + 1, 0);
  }

  private static String displayName(Cycle cycle) {
    return "Cycle " + cycle.getStartDate().getMonth().getDisplayName(TextStyle.SHORT,
        Locale.ENGLISH) + " " + cycle.getStartDate().getYear();
  }

  private static BigDecimal biomassGain(Cycle cycle) {
    if (cycle.getStockingBiomassKg() == null || cycle.getHarvestBiomassKg() == null) {
      return null;
    }
    return cycle.getHarvestBiomassKg().subtract(cycle.getStockingBiomassKg());
  }

  private Map<String, Object> feedTypeOption(FeedType ft) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("feedTypeId", ft.getFeedTypeId().toString());
    row.put("name", ft.getName());
    row.put("packKg", ft.getPackKg());
    row.put("packPrice", ft.getPackPrice());
    row.put("currency", ft.getCurrency());
    row.put("unitPrice", unitPrice(ft.getPackKg(), ft.getPackPrice()));
    return row;
  }

  private Map<String, Object> cycleJson(Cycle cycle, int elapsed) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("cycleId", cycle.getCycleId().toString());
    row.put("pondId", cycle.getPondId().toString());
    row.put("displayName", displayName(cycle));
    row.put("startDate", cycle.getStartDate().toString());
    row.put("endDate", cycle.getEndDate() == null ? null : cycle.getEndDate().toString());
    row.put("status", cycle.getStatus());
    row.put("elapsedDays", elapsed);
    row.put("stockingBiomassKg", cycle.getStockingBiomassKg());
    row.put("harvestBiomassKg", cycle.getHarvestBiomassKg());
    return row;
  }

  private Map<String, Object> kpis(Cycle cycle, Map<Integer, List<FeedLog>> byDay,
                                   int horizon, int elapsed) {
    Totals totals = totals(byDay, 1, horizon);
    BigDecimal gain = biomassGain(cycle);
    BigDecimal fcr = null;
    if (gain != null && gain.compareTo(ZERO) > 0) {
      fcr = totals(byDay, 1, elapsed).feed().divide(gain, 2, RoundingMode.HALF_UP);
    }
    BigDecimal avg = horizon > 0 ? totals.feed().divide(BigDecimal.valueOf(horizon), 2,
        RoundingMode.HALF_UP) : ZERO.setScale(2);
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("feedKg", totals.feed());
    row.put("cost", totals.cost());
    row.put("avgKgPerDay", avg);
    row.put("biomassGainKg", gain);
    row.put("fcr", fcr);
    return row;
  }

  private Map<String, Object> changes(Map<String, Object> base, Map<String, Object> compare) {
    BigDecimal feed = (BigDecimal) base.get("feedKg");
    BigDecimal compareFeed = (BigDecimal) compare.get("feedKg");
    Double feedPct = pct(feed, compareFeed);
    BigDecimal fcr = (BigDecimal) base.get("fcr");
    BigDecimal compareFcr = (BigDecimal) compare.get("fcr");
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("feedPct", feedPct);
    row.put("costPct", pct((BigDecimal) base.get("cost"), (BigDecimal) compare.get("cost")));
    row.put("avgPct", feedPct);
    row.put("gainPct", pct((BigDecimal) base.get("biomassGainKg"),
        (BigDecimal) compare.get("biomassGainKg")));
    row.put("fcrDiff", fcr == null || compareFcr == null ? null
        : fcr.subtract(compareFcr).setScale(2, RoundingMode.HALF_UP));
    return row;
  }

  private List<Map<String, Object>> days(Cycle cycle, Map<Integer, List<FeedLog>> byDay,
                                         int axisLen) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (int d = 1; d <= axisLen; d++) {
      List<FeedLog> rows = new ArrayList<>(byDay.getOrDefault(d, List.of()));
      rows.sort(Comparator.comparing((FeedLog r) -> r.getFedTime() == null)
          .thenComparing(r -> r.getFedTime() == null ? LocalTime.MIN : r.getFedTime()));
      Totals totals = totals(byDay, d, d);
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("day", d);
      row.put("date", cycle.getStartDate().plusDays(d - 1L).toString());
      row.put("totalKg", totals.feed());
      row.put("cost", totals.cost());
      row.put("entries", rows.stream().map(this::dayEntry).toList());
      out.add(row);
    }
    return out;
  }

  private Map<String, Object> dayEntry(FeedLog row) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("feedLogId", row.getFeedLogId().toString());
    entry.put("feedTypeId", row.getFeedType().getFeedTypeId().toString());
    entry.put("feedTypeName", row.getFeedType().getName());
    entry.put("amountKg", row.getAmountKg());
    entry.put("packKg", row.getPackKg());
    entry.put("packPrice", row.getPackPrice());
    entry.put("cost", rowCost(row.getAmountKg(), row.getPackKg(), row.getPackPrice()));
    entry.put("fedTime", row.getFedTime() == null ? null : row.getFedTime().format(FEED_TIME));
    return entry;
  }

  private List<Map<String, Object>> stageSummaries(
      Map<String, Object> template, Map<Integer, List<FeedLog>> byDay, int elapsed,
      Map<Integer, List<FeedLog>> compareByDay, Integer compareElapsed) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> stage : stages(template)) {
      int start = (int) stage.get("startDay");
      int end = (int) stage.get("endDay");
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("stage", stage.get("name"));
      if (start > elapsed) {
        row.put("feedKg", null);
        row.put("cost", null);
        row.put("avgKgPerDay", null);
        row.put("missedDays", 0);
        row.put("changePct", null);
        out.add(row);
        continue;
      }
      int dayTo = Math.min(end, elapsed);
      Totals totals = totals(byDay, start, dayTo);
      int daysInWindow = dayTo - start + 1;
      int missed = 0;
      for (int d = start; d <= dayTo; d++) {
        if (byDay.getOrDefault(d, List.of()).isEmpty()) {
          missed++;
        }
      }
      row.put("feedKg", totals.feed());
      row.put("cost", totals.cost());
      row.put("avgKgPerDay", totals.feed().divide(BigDecimal.valueOf(daysInWindow), 2,
          RoundingMode.HALF_UP));
      row.put("missedDays", missed);
      row.put("changePct", null);
      if (compareByDay != null && compareElapsed != null && start <= compareElapsed) {
        int overlapTo = Math.min(dayTo, Math.min(end, compareElapsed));
        row.put("changePct", pct(totals(byDay, start, overlapTo).feed(),
            totals(compareByDay, start, overlapTo).feed()));
      }
      out.add(row);
    }
    return out;
  }

  private List<Map<String, Object>> treatments(Cycle cycle, int axisLen) {
    LocalDate start = cycle.getStartDate();
    LocalDate windowEnd = start.plusDays(axisLen - 1L);
    List<Map<String, Object>> out = new ArrayList<>();
    for (PondTreatment pt : pondTreatments.findByPondIdAndStartedAtLessThanEqualOrderByStartedAtAsc(
        cycle.getPondId(), windowEnd)) {
      if (pt.getEndedAt() != null && pt.getEndedAt().isBefore(start)) {
        continue;
      }
      int startDay = (int) (pt.getStartedAt().toEpochDay() - start.toEpochDay()) + 1;
      boolean startedBefore = startDay < 1;
      if (startedBefore) {
        startDay = 1;
      }
      Integer endDay = null;
      if (pt.getEndedAt() != null) {
        int derived = (int) (pt.getEndedAt().toEpochDay() - start.toEpochDay()) + 1;
        if (derived <= axisLen) {
          endDay = derived;
        }
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("pondTreatmentId", pt.getPondTreatmentId().toString());
      row.put("name", pt.getTreatment().getName());
      row.put("code", pt.getTreatment().getCode());
      row.put("startDay", startDay);
      row.put("endDay", endDay);
      row.put("startDate", pt.getStartedAt().toString());
      row.put("endDate", pt.getEndedAt() == null ? null : pt.getEndedAt().toString());
      row.put("ongoing", pt.getEndedAt() == null);
      row.put("startedBefore", startedBefore);
      row.put("notes", pt.getNotes() == null || pt.getNotes().isBlank() ? null : pt.getNotes());
      out.add(row);
    }
    return out;
  }

  private static Totals totals(Map<Integer, List<FeedLog>> byDay, int dayFrom, int dayTo) {
    BigDecimal feed = ZERO;
    BigDecimal cost = ZERO;
    for (int d = dayFrom; d <= dayTo; d++) {
      for (FeedLog row : byDay.getOrDefault(d, List.of())) {
        feed = feed.add(row.getAmountKg());
        cost = cost.add(rowCost(row.getAmountKg(), row.getPackKg(), row.getPackPrice()));
      }
    }
    return new Totals(feed, cost);
  }

  record Totals(BigDecimal feed, BigDecimal cost) {}

  public static class NotFoundDetail extends RuntimeException {
    public NotFoundDetail(String message) {
      super(message);
    }
  }
}
