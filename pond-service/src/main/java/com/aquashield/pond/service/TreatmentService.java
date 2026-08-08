package com.aquashield.pond.service;

import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.api.project.v1.EnergySettings;
import com.aquashield.api.project.v1.GetEnergySettingsRequest;
import com.aquashield.api.project.v1.GetParameterSettingsRequest;
import com.aquashield.api.project.v1.ParameterSetting;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.pond.api.dto.PondDtos.CreatePondTreatmentRequest;
import com.aquashield.pond.api.dto.PondDtos.CreateTreatmentRequest;
import com.aquashield.pond.api.dto.PondDtos.PondTreatmentDto;
import com.aquashield.pond.api.dto.PondDtos.TreatmentCourseCycleDto;
import com.aquashield.pond.api.dto.PondDtos.TreatmentDto;
import com.aquashield.pond.api.dto.PondDtos.UpdateTreatmentRequest;
import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Entities.Treatment;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.repo.Repos.CycleRepository;
import com.aquashield.pond.repo.Repos.PondRepository;
import com.aquashield.pond.repo.Repos.PondTreatmentRepository;
import com.aquashield.pond.repo.Repos.TreatmentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TreatmentService {

  private static final Logger log = LoggerFactory.getLogger(TreatmentService.class);
  private static final BigDecimal ZERO = BigDecimal.ZERO;
  private static final Map<String, BigDecimal> MASS_FACTORS =
      Map.of("g", new BigDecimal("0.001"), "kg", BigDecimal.ONE);
  private static final Map<String, BigDecimal> VOLUME_FACTORS =
      Map.of("ml", new BigDecimal("0.001"), "l", BigDecimal.ONE);
  private static final Set<String> UNITS = Set.of("g", "kg", "ml", "l");
  private static final Map<String, String> CURRENCY_SYMBOLS = Map.ofEntries(
      Map.entry("USD", "$"),
      Map.entry("SGD", "S$"),
      Map.entry("MYR", "RM"),
      Map.entry("THB", "฿"),
      Map.entry("VND", "₫"),
      Map.entry("MMK", "K"),
      Map.entry("EUR", "€"),
      Map.entry("GBP", "£"));

  static final List<String> CANONICAL_ORDER = List.of(
      "ammonia", "dissolved_oxygen", "turbidity", "ph", "alkalinity",
      "nitrite", "nitrate", "tan", "ammonium", "salinity", "temperature",
      "total_hardness", "calcium", "magnesium", "phosphate", "carbonate",
      "bicarbonate", "hydrogen_sulfide", "ph_lab", "water_level",
      "total_vibrio_count", "total_bacteria_count");

  private final PondRepository ponds;
  private final CycleRepository cycles;
  private final TreatmentRepository treatments;
  private final PondTreatmentRepository pondTreatments;
  private final ProjectServiceGrpc.ProjectServiceBlockingStub projectStub;
  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub;
  private final ObjectMapper mapper;
  private final ZoneId zone;

  public TreatmentService(PondRepository ponds, CycleRepository cycles,
                          TreatmentRepository treatments,
                          PondTreatmentRepository pondTreatments,
                          ProjectServiceGrpc.ProjectServiceBlockingStub projectStub,
                          IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub,
                          ObjectMapper mapper,
                          @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.ponds = ponds;
    this.cycles = cycles;
    this.treatments = treatments;
    this.pondTreatments = pondTreatments;
    this.projectStub = projectStub;
    this.ingestionStub = ingestionStub;
    this.mapper = mapper;
    this.zone = ZoneId.of(timezone);
  }

  public static BigDecimal courseCost(BigDecimal amount, String unit, BigDecimal unitPrice,
                                      String priceUnit) {
    if (amount == null || unitPrice == null || unitPrice.compareTo(ZERO) <= 0) {
      return null;
    }
    BigDecimal factor = unitFactor(unit, priceUnit);
    if (factor == null) {
      return null;
    }
    return amount.multiply(factor).multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
  }

  @Transactional(readOnly = true)
  public List<TreatmentDto> listTreatments(UUID projectId) {
    List<Treatment> rows = projectId == null
        ? treatments.findAllByOrderByNameAsc()
        : treatments.findByProjectIdOrProjectIdIsNullOrderByNameAsc(projectId);
    return rows.stream().map(TreatmentDto::from).toList();
  }

  @Transactional
  public TreatmentDto createTreatment(CreateTreatmentRequest req) {
    String name = requireText(req.name(), "name is required");
    List<String> targets = cleanTargets(req.targetParameters());
    if (targets.isEmpty()) {
      throw new PondAppService.BadRequest("Pick at least one watched reading");
    }
    if (treatments.findByProjectIdAndName(req.projectId(), name).isPresent()) {
      throw new PondAppService.BadRequest("A treatment with this name already exists");
    }
    BigDecimal unitPrice = req.unitPrice() == null ? ZERO : req.unitPrice();
    if (unitPrice.compareTo(ZERO) < 0) {
      throw new PondAppService.BadRequest("Price can't be negative");
    }
    Treatment t = new Treatment(req.projectId(), uniqueCode(req.projectId(), name), name,
        req.description(), mapper.valueToTree(targets), unitPrice, priceUnit(req.priceUnit()));
    if (req.active() != null) {
      t.setActive(req.active());
    }
    return TreatmentDto.from(treatments.saveAndFlush(t));
  }

  @Transactional
  public TreatmentDto updateTreatment(UUID treatmentId, UpdateTreatmentRequest req) {
    Treatment t = projectScopedTreatment(treatmentId);
    if (req.projectId() != null && !req.projectId().equals(t.getProjectId())) {
      throw new PondAppService.BadRequest("A treatment can't move to another project");
    }
    if (req.name() != null) {
      String name = requireText(req.name(), "name is required");
      if (treatments.existsByProjectIdAndNameAndTreatmentIdNot(
          t.getProjectId(), name, treatmentId)) {
        throw new PondAppService.BadRequest("A treatment with this name already exists");
      }
      t.setName(name);
    }
    if (req.description() != null) {
      t.setDescription(req.description());
    }
    if (req.targetParameters() != null) {
      List<String> targets = cleanTargets(req.targetParameters());
      if (targets.isEmpty()) {
        throw new PondAppService.BadRequest("Pick at least one watched reading");
      }
      t.setTargetParameters(mapper.valueToTree(targets));
    }
    if (req.unitPrice() != null) {
      if (req.unitPrice().compareTo(ZERO) < 0) {
        throw new PondAppService.BadRequest("Price can't be negative");
      }
      t.setUnitPrice(req.unitPrice());
    }
    if (req.priceUnit() != null) {
      t.setPriceUnit(priceUnit(req.priceUnit()));
    }
    if (req.active() != null) {
      t.setActive(req.active());
    }
    return TreatmentDto.from(treatments.saveAndFlush(t));
  }

  @Transactional
  public void deleteTreatment(UUID treatmentId) {
    Treatment t = projectScopedTreatment(treatmentId);
    if (pondTreatments.countByTreatmentTreatmentId(treatmentId) > 0) {
      throw new PondAppService.BadRequest(
          "This treatment is already used by treatment records. Retire it instead.");
    }
    treatments.delete(t);
  }

  @Transactional(readOnly = true)
  public UUID treatmentProjectId(UUID treatmentId) {
    return projectScopedTreatment(treatmentId).getProjectId();
  }

  @Transactional(readOnly = true)
  public List<PondTreatmentDto> listCourses(UUID pondId) {
    return pondTreatments.findByPondIdOrderByStartedAtDesc(pondId).stream()
        .map(this::courseDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<PondTreatmentDto> listCoursesForProjects(List<UUID> projectIds) {
    if (projectIds == null || projectIds.isEmpty()) {
      return List.of();
    }
    List<UUID> pondIds = new ArrayList<>();
    for (UUID projectId : projectIds) {
      ponds.findByProjectIdOrderByNameAsc(projectId).forEach(p -> pondIds.add(p.getPondId()));
    }
    if (pondIds.isEmpty()) {
      return List.of();
    }
    return pondTreatments.findByPondIdInOrderByStartedAtDesc(pondIds).stream()
        .map(this::courseDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<PondTreatmentDto> listAllCourses() {
    return pondTreatments.findAll().stream()
        .sorted(Comparator.comparing(PondTreatment::getStartedAt,
            Comparator.nullsLast(Comparator.reverseOrder())))
        .map(this::courseDto)
        .toList();
  }

  @Transactional
  public PondTreatmentDto createCourse(CreatePondTreatmentRequest req, UUID actingUserId) {
    Pond pond = ponds.findById(req.pondId()).orElseThrow(PondAppService.NotFound::new);
    Treatment treatment = treatments.findById(req.treatmentId())
        .orElseThrow(() -> new PondAppService.BadRequest("Treatment not found"));
    validateCourseDates(req.startedAt(), req.endedAt());
    validateProductForPond(treatment, pond, false);
    validateDose(req.amount(), nullIfBlank(req.unit()), treatment);
    PondTreatment row = new PondTreatment(pond.getPondId(), treatment, req.startedAt(),
        req.endedAt(), req.notes(), req.amount(), nullIfBlank(req.unit()), actingUserId);
    return courseDto(pondTreatments.saveAndFlush(row));
  }

  @Transactional
  public PondTreatmentDto updateCourse(UUID courseId, JsonNode body, UUID actingUserId) {
    PondTreatment row = pondTreatments.findById(courseId).orElseThrow(PondAppService.NotFound::new);
    Pond pond = ponds.findById(row.getPondId()).orElseThrow(PondAppService.NotFound::new);

    UUID requestedPond = uuidField(body, "pond", "pond_id");
    if (requestedPond != null && !requestedPond.equals(row.getPondId())) {
      throw new PondAppService.BadRequest("A course can't move to another pond");
    }

    Treatment product = row.getTreatment();
    boolean productChanged = false;
    UUID requestedTreatment = uuidField(body, "treatment", "treatment_id");
    if (requestedTreatment != null) {
      product = treatments.findById(requestedTreatment)
          .orElseThrow(() -> new PondAppService.BadRequest("Treatment not found"));
      productChanged = !product.getTreatmentId().equals(row.getTreatment().getTreatmentId());
      validateProductForPond(product, pond, !productChanged);
      if (productChanged) {
        row.setTreatment(product);
      }
    }

    LocalDate started = has(body, "started_at")
        ? requiredDateField(body, "started_at", "started_at is required")
        : row.getStartedAt();
    LocalDate ended = has(body, "ended_at") ? optionalDateField(body, "ended_at") : row.getEndedAt();
    validateCourseDates(started, ended);
    row.setStartedAt(started);
    row.setEndedAt(ended);

    if (has(body, "notes")) {
      row.setNotes(textOrNull(body.get("notes")));
    }

    BigDecimal amount = has(body, "amount") ? decimalOrNull(body.get("amount")) : row.getAmount();
    String unit = has(body, "unit") ? nullIfBlank(textOrNull(body.get("unit"))) : row.getUnit();
    if (has(body, "amount") || has(body, "unit")) {
      validateDose(amount, unit, product);
      row.setAmount(amount);
      row.setUnit(unit);
    }
    if (productChanged || (row.getPriceUnit() == null && amount != null)) {
      row.snapshotPrice(product);
    }
    row.setUpdatedBy(actingUserId);
    return courseDto(pondTreatments.saveAndFlush(row));
  }

  @Transactional
  public void deleteCourse(UUID courseId) {
    PondTreatment row = pondTreatments.findById(courseId).orElseThrow(PondAppService.NotFound::new);
    pondTreatments.delete(row);
  }

  @Transactional(readOnly = true)
  public UUID courseProjectId(UUID courseId) {
    PondTreatment row = pondTreatments.findById(courseId).orElseThrow(PondAppService.NotFound::new);
    return ponds.findById(row.getPondId()).orElseThrow(PondAppService.NotFound::new).getProjectId();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> stability(UUID pondId, List<UUID> courseIds) {
    Pond pond = ponds.findById(pondId).orElseThrow(PondAppService.NotFound::new);
    if (courseIds == null || courseIds.isEmpty()) {
      throw new PondAppService.BadRequest("pond and courses are required");
    }
    List<PondTreatment> courses = pondTreatments
        .findByPondIdAndPondTreatmentIdInOrderByStartedAtDesc(pondId, courseIds);
    if (courses.size() != new HashSet<>(courseIds).size()) {
      throw new NotFoundDetail("Course not found");
    }

    LocalDate today = LocalDate.now();
    LocalDate start = courses.stream().map(PondTreatment::getStartedAt)
        .max(LocalDate::compareTo).orElse(today);
    LocalDate end = courses.stream().map(c -> c.getEndedAt() == null ? today : c.getEndedAt())
        .min(LocalDate::compareTo).orElse(today);
    if (end.isBefore(start)) {
      return Map.of("overlap", false);
    }

    Watched watched = watched(courses);
    Map<String, ParameterSetting> limits = limitsFor(pond.getProjectId());
    List<String> readingParams = new ArrayList<>(watched.codes());
    readingParams.add("electricity");
    List<ReadingRow> readings = fetchReadings(pondId, start, end, readingParams);

    List<String> rendered = new ArrayList<>();
    List<Map<String, Object>> params = new ArrayList<>();
    for (String code : watched.codes()) {
      ParameterSetting setting = limits.get(code);
      if (setting == null || (!setting.getHasMin() && !setting.getHasMax())) {
        continue;
      }
      List<Double> values = readings.stream()
          .map(r -> r.getValuesMap().get(code))
          .filter(v -> v != null)
          .toList();
      if (values.isEmpty()) {
        continue;
      }
      long safe = values.stream().filter(v -> safe(v, setting)).count();
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("code", code);
      row.put("name", setting.getParameterName());
      row.put("safe", safe);
      row.put("total", values.size());
      row.put("pct", Math.round(safe * 100.0 / values.size()));
      row.put("declaredBy", watched.declaredBy().getOrDefault(code, List.of()));
      params.add(row);
      rendered.add(code);
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("overlap", true);
    payload.put("window", Map.of("start", start.toString(), "end", end.toString(),
        "days", end.toEpochDay() - start.toEpochDay() + 1));
    payload.put("params", params);

    if (!rendered.isEmpty()) {
      int safeMoments = 0;
      int totalMoments = 0;
      for (ReadingRow reading : readings) {
        boolean seen = false;
        boolean allSafe = true;
        for (String code : rendered) {
          Double value = reading.getValuesMap().get(code);
          if (value == null) {
            continue;
          }
          seen = true;
          if (!safe(value, limits.get(code))) {
            allSafe = false;
          }
        }
        if (seen) {
          totalMoments++;
          if (allSafe) {
            safeMoments++;
          }
        }
      }
      if (totalMoments > 0) {
        payload.put("overall", Map.of("safe", safeMoments, "total", totalMoments,
            "pct", Math.round(safeMoments * 100.0 / totalMoments)));
      }
    }

    List<Double> kwhValues = readings.stream()
        .map(r -> r.getValuesMap().get("electricity"))
        .filter(v -> v != null)
        .toList();
    List<Map<String, Object>> costRows = new ArrayList<>();
    for (PondTreatment c : courses) {
      BigDecimal cost = courseCost(c.getAmount(), c.getUnit(), c.getUnitPrice(), c.getPriceUnit());
      if (cost != null) {
        costRows.add(Map.of("name", c.getTreatment().getName(), "amount", c.getAmount(),
            "unit", c.getUnit(), "cost", cost));
      }
    }

    if (!kwhValues.isEmpty() || !costRows.isEmpty()) {
      ProjectMoney money = projectMoney(pond.getProjectId());
      if (!kwhValues.isEmpty()) {
        BigDecimal kwh = BigDecimal.valueOf(kwhValues.stream().mapToDouble(Double::doubleValue).sum())
            .setScale(1, RoundingMode.HALF_UP);
        payload.put("electricity", Map.of("kwh", kwh,
            "cost", kwh.multiply(money.tariff()).setScale(2, RoundingMode.HALF_UP),
            "tariff", money.tariff(), "currency", money.currency()));
      }
      if (!costRows.isEmpty()) {
        BigDecimal total = ZERO;
        for (Map<String, Object> row : costRows) {
          total = total.add((BigDecimal) row.get("cost"));
        }
        payload.put("treatmentCost", Map.of("courses", costRows,
            "total", total.setScale(2, RoundingMode.HALF_UP), "currency", money.currency()));
      }
    }

    return payload;
  }

  private Treatment projectScopedTreatment(UUID treatmentId) {
    Treatment t = treatments.findById(treatmentId).orElseThrow(PondAppService.NotFound::new);
    if (t.getProjectId() == null) {
      throw new PondAppService.BadRequest(
          "Global seed treatments must be recreated under a project before editing.");
    }
    return t;
  }

  private PondTreatmentDto courseDto(PondTreatment row) {
    return PondTreatmentDto.from(row, courseCycles(row));
  }

  private List<TreatmentCourseCycleDto> courseCycles(PondTreatment row) {
    LocalDate today = LocalDate.now();
    LocalDate windowEnd = row.getEndedAt() == null ? today : row.getEndedAt();
    List<TreatmentCourseCycleDto> out = new ArrayList<>();
    List<Cycle> ordered = cycles.findByPondIdOrderByStartDateAsc(row.getPondId());
    for (int i = 0; i < ordered.size(); i++) {
      Cycle cycle = ordered.get(i);
      LocalDate cycleEnd = cycle.getEndDate() == null ? today : cycle.getEndDate();
      if (!row.getStartedAt().isAfter(cycleEnd) && !windowEnd.isBefore(cycle.getStartDate())) {
        out.add(new TreatmentCourseCycleDto(cycle.getCycleId(), "Cycle " + (i + 1),
            cycle.getStartDate(), cycle.getEndDate()));
      }
    }
    return out;
  }

  private void validateProductForPond(Treatment treatment, Pond pond, boolean unchanged) {
    if (!unchanged && !treatment.isActive()) {
      throw new PondAppService.BadRequest("This treatment type is retired");
    }
    if (treatment.getProjectId() != null && !treatment.getProjectId().equals(pond.getProjectId())) {
      throw new PondAppService.BadRequest("This treatment belongs to another project");
    }
  }

  private static void validateCourseDates(LocalDate startedAt, LocalDate endedAt) {
    LocalDate today = LocalDate.now();
    if (startedAt == null) {
      throw new PondAppService.BadRequest("started_at is required");
    }
    if (startedAt.isAfter(today)) {
      throw new PondAppService.BadRequest("Start can't be in the future");
    }
    if (endedAt != null && endedAt.isAfter(today)) {
      throw new PondAppService.BadRequest("End can't be in the future");
    }
    if (endedAt != null && endedAt.isBefore(startedAt)) {
      throw new PondAppService.BadRequest("End can't be before the start");
    }
  }

  private static void validateDose(BigDecimal amount, String unit, Treatment product) {
    if ((amount == null) != (unit == null)) {
      throw new PondAppService.BadRequest("Amount and unit go together");
    }
    if (amount == null) {
      return;
    }
    if (amount.compareTo(ZERO) <= 0) {
      throw new PondAppService.BadRequest("Amount must be more than zero");
    }
    if (!UNITS.contains(unit)) {
      throw new PondAppService.BadRequest("Unit must be g, kg, ml or l");
    }
    Map<String, BigDecimal> family = family(product.getPriceUnit());
    if (family != null && !family.containsKey(unit)) {
      String allowed = String.join(" or ", family.keySet().stream().sorted().toList());
      throw new PondAppService.BadRequest(product.getName() + " is measured in " + allowed);
    }
  }

  private static String priceUnit(String value) {
    String normalized = value == null || value.isBlank() ? "kg" : value.toLowerCase(Locale.ROOT);
    if (!"kg".equals(normalized) && !"l".equals(normalized)) {
      throw new PondAppService.BadRequest("Price basis must be kg or l");
    }
    return normalized;
  }

  private String uniqueCode(UUID projectId, String name) {
    String base = slug(name);
    String candidate = base;
    int n = 2;
    while (treatments.existsByProjectIdAndCode(projectId, candidate)) {
      candidate = base + "-" + n;
      n++;
    }
    return candidate;
  }

  private static String slug(String name) {
    String normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", "-")
        .replaceAll("(^-+|-+$)", "");
    return normalized.isBlank() ? "treatment" : normalized;
  }

  private static String requireText(String value, String message) {
    if (value == null || value.isBlank()) {
      throw new PondAppService.BadRequest(message);
    }
    return value.trim();
  }

  private static List<String> cleanTargets(List<String> targets) {
    if (targets == null) {
      return List.of();
    }
    LinkedHashSet<String> out = new LinkedHashSet<>();
    for (String target : targets) {
      if (target == null || target.isBlank()) {
        throw new PondAppService.BadRequest("Watched readings must be a list of parameter codes");
      }
      out.add(target.trim());
    }
    return new ArrayList<>(out);
  }

  private Watched watched(List<PondTreatment> courses) {
    Set<String> raw = new HashSet<>();
    Map<String, List<String>> declared = new LinkedHashMap<>();
    for (PondTreatment course : courses) {
      for (String code : targetParameters(course.getTreatment())) {
        raw.add(code);
        List<String> names = declared.computeIfAbsent(code, k -> new ArrayList<>());
        if (!names.contains(course.getTreatment().getName())) {
          names.add(course.getTreatment().getName());
        }
      }
    }
    List<String> ordered = CANONICAL_ORDER.stream().filter(raw::contains).toList();
    declared.values().forEach(names -> names.sort(String::compareToIgnoreCase));
    return new Watched(ordered, declared);
  }

  private static List<String> targetParameters(Treatment treatment) {
    JsonNode node = treatment.getTargetParameters();
    if (node == null || !node.isArray()) {
      return List.of();
    }
    List<String> out = new ArrayList<>();
    node.forEach(item -> {
      if (item.isTextual() && !item.asText().isBlank()) {
        out.add(item.asText());
      }
    });
    return out;
  }

  private Map<String, ParameterSetting> limitsFor(UUID projectId) {
    try {
      Map<String, ParameterSetting> out = new LinkedHashMap<>();
      var resp = projectStub.getParameterSettings(GetParameterSettingsRequest.newBuilder()
          .setProjectId(projectId.toString())
          .build());
      for (ParameterSetting setting : resp.getSettingsList()) {
        if (setting.getHasMin() || setting.getHasMax()) {
          out.put(setting.getParameterCode(), setting);
        }
      }
      return out;
    } catch (Exception e) {
      log.warn("Project threshold lookup failed project={} — stability served without bands: {}",
          projectId, e.toString());
      return Map.of();
    }
  }

  private List<ReadingRow> fetchReadings(UUID pondId, LocalDate start, LocalDate end,
                                         List<String> parameters) {
    try {
      Instant from = start.atStartOfDay(zone).toInstant();
      Instant to = end.plusDays(1).atStartOfDay(zone).minusNanos(1).toInstant();
      GetReadingsRequest.Builder req = GetReadingsRequest.newBuilder()
          .setPondId(pondId.toString())
          .setStart(from.toString())
          .setEnd(to.toString())
          .setLimit(50000);
      parameters.stream().distinct().forEach(req::addParameters);
      return ingestionStub.getReadings(req.build()).getRowsList();
    } catch (Exception e) {
      log.warn("Treatment stability readings fetch failed pond={} — serving empty: {}",
          pondId, e.toString());
      return List.of();
    }
  }

  private ProjectMoney projectMoney(UUID projectId) {
    try {
      EnergySettings settings = projectStub.getEnergySettings(GetEnergySettingsRequest.newBuilder()
          .setProjectId(projectId.toString())
          .setType("electricity")
          .build());
      BigDecimal tariff = BigDecimal.valueOf(settings.getTariffPerUnit());
      String currency = CURRENCY_SYMBOLS.getOrDefault(settings.getCurrency(), settings.getCurrency());
      return new ProjectMoney(tariff, currency == null || currency.isBlank() ? "$" : currency);
    } catch (Exception e) {
      log.warn("Project energy settings lookup failed project={} — using zero tariff: {}",
          projectId, e.toString());
      return new ProjectMoney(ZERO, "$");
    }
  }

  private static boolean safe(double value, ParameterSetting setting) {
    return (!setting.getHasMin() || value >= setting.getMinValue())
        && (!setting.getHasMax() || value <= setting.getMaxValue());
  }

  private static boolean has(JsonNode body, String field) {
    return body != null && body.has(field);
  }

  private static UUID uuidField(JsonNode body, String primary, String alias) {
    String value = textOrNull(body == null ? null : (body.has(primary) ? body.get(primary) : body.get(alias)));
    try {
      return value == null ? null : UUID.fromString(value);
    } catch (IllegalArgumentException e) {
      throw new PondAppService.BadRequest("Invalid pond or course id");
    }
  }

  private static LocalDate requiredDateField(JsonNode body, String field, String message) {
    LocalDate date = optionalDateField(body, field);
    if (date == null) {
      throw new PondAppService.BadRequest(message);
    }
    return date;
  }

  private static LocalDate optionalDateField(JsonNode body, String field) {
    String value = textOrNull(body.get(field));
    try {
      return value == null ? null : LocalDate.parse(value);
    } catch (RuntimeException e) {
      throw new PondAppService.BadRequest("Invalid date format; use YYYY-MM-DD");
    }
  }

  private static BigDecimal decimalOrNull(JsonNode node) {
    String value = textOrNull(node);
    try {
      return value == null ? null : new BigDecimal(value);
    } catch (NumberFormatException e) {
      throw new PondAppService.BadRequest("Amount must be more than zero");
    }
  }

  private static String textOrNull(JsonNode node) {
    if (node == null || node.isNull()) {
      return null;
    }
    String value = node.asText();
    return value == null || value.isBlank() ? null : value;
  }

  private static String nullIfBlank(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private static BigDecimal unitFactor(String unit, String priceUnit) {
    Map<String, BigDecimal> family = family(priceUnit);
    return family == null ? null : family.get(unit);
  }

  private static Map<String, BigDecimal> family(String priceUnit) {
    return switch (priceUnit == null ? "" : priceUnit) {
      case "kg" -> MASS_FACTORS;
      case "l" -> VOLUME_FACTORS;
      default -> null;
    };
  }

  record Watched(List<String> codes, Map<String, List<String>> declaredBy) {}

  record ProjectMoney(BigDecimal tariff, String currency) {}

  public static class NotFoundDetail extends RuntimeException {
    public NotFoundDetail(String message) {
      super(message);
    }
  }
}
