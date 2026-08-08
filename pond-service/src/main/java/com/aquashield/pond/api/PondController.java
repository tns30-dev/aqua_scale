package com.aquashield.pond.api;

import com.aquashield.pond.api.dto.PondDtos.CreatePondTreatmentRequest;
import com.aquashield.pond.api.dto.PondDtos.CreatePondRequest;
import com.aquashield.pond.api.dto.PondDtos.CreateTreatmentRequest;
import com.aquashield.pond.api.dto.PondDtos.CreateFeedTypeRequest;
import com.aquashield.pond.api.dto.PondDtos.CycleBiomassRequest;
import com.aquashield.pond.api.dto.PondDtos.CycleDto;
import com.aquashield.pond.api.dto.PondDtos.FeedDayWriteRequest;
import com.aquashield.pond.api.dto.PondDtos.FeedTypeRecordDto;
import com.aquashield.pond.api.dto.PondDtos.PondDto;
import com.aquashield.pond.api.dto.PondDtos.PondTreatmentDto;
import com.aquashield.pond.api.dto.PondDtos.StartCycleRequest;
import com.aquashield.pond.api.dto.PondDtos.TreatmentDto;
import com.aquashield.pond.api.dto.PondDtos.UpdateCycleRequest;
import com.aquashield.pond.api.dto.PondDtos.UpdateFeedTypeRequest;
import com.aquashield.pond.api.dto.PondDtos.UpdatePondRequest;
import com.aquashield.pond.api.dto.PondDtos.UpdateTreatmentRequest;
import com.aquashield.pond.config.SnapshotAuthFilter.SnapshotPrincipal;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.service.ComparisonService;
import com.aquashield.pond.service.FeedingService;
import com.aquashield.pond.service.HistoricalService;
import com.aquashield.pond.service.LatestReadingService;
import com.aquashield.pond.service.PondAppService;
import com.aquashield.pond.service.TreatmentService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pond REST. AUTHZ: reads = project member via snapshot (non-member 404 parity);
 * pond/cycle admin writes stay platform-admin-only; feeding writes are project-member ops.
 * Casing per endpoint preserved (snake lists, camelCase details/comparison).
 */
@RestController
public class PondController {

  private final PondAppService service;
  private final ComparisonService comparison;
  private final FeedingService feeding;
  private final TreatmentService treatmentService;
  private final HistoricalService historical;
  private final LatestReadingService latestReadingService;

  public PondController(PondAppService service, ComparisonService comparison,
                        FeedingService feeding, TreatmentService treatmentService,
                        HistoricalService historical,
                        LatestReadingService latestReadingService) {
    this.service = service;
    this.comparison = comparison;
    this.feeding = feeding;
    this.treatmentService = treatmentService;
    this.historical = historical;
    this.latestReadingService = latestReadingService;
  }

  // ---------- ponds ----------

  /** PARITY: GET /api/ponds?projectId= -> {"ponds":[...]} (Overview/DigitalTwin feed). */
  @GetMapping("/api/ponds")
  public Map<String, Object> listPonds(@RequestParam UUID projectId,
                                       @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return service.listPonds(projectId);
  }

  /** Bootstrap the UI with persisted latest readings before WebSocket messages arrive. */
  @GetMapping({"/api/ponds/latest-readings", "/api/ponds/latest-readings/"})
  public Map<String, Object> latestReadings(
      @RequestParam UUID projectId,
      @RequestParam(required = false) String ponds,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return latestReadingService.latestReadings(projectId, parseOptionalUuidList(ponds));
  }

  @GetMapping("/api/ponds/{pondId}")
  public PondDto getPond(@PathVariable UUID pondId,
                         @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(pondId);
    return service.getPond(pondId, hasAccess(principal, pond.getProjectId()));
  }

  /** Legacy historical time-series. The charts API (analytics-service) is preferred. */
  @GetMapping({"/api/ponds/{pondId}/historical", "/api/ponds/{pondId}/historical/"})
  public Map<String, Object> getHistorical(
      @PathVariable UUID pondId,
      @RequestParam(required = false) String start,
      @RequestParam(required = false) String end,
      @RequestParam(required = false) String parameters,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(pondId);
    requireMembership(principal, pond.getProjectId());
    LocalDate startDate = (start != null && !start.isBlank()) ? LocalDate.parse(start)
        : LocalDate.now().minusDays(30);
    LocalDate endDate = (end != null && !end.isBlank()) ? LocalDate.parse(end) : LocalDate.now();
    List<String> params = (parameters != null && !parameters.isBlank())
        ? List.of(parameters.split(",")) : List.of();
    return historical.getHistorical(pondId, startDate, endDate, params);
  }

  @PostMapping("/api/projects/{projectId}/ponds")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public ResponseEntity<PondDto> createPond(@PathVariable UUID projectId,
                                            @Valid @RequestBody CreatePondRequest body) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.createPond(projectId, body));
  }

  @PatchMapping("/api/ponds/{pondId}")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public PondDto updatePond(@PathVariable UUID pondId, @RequestBody UpdatePondRequest body) {
    return service.updatePond(pondId, body);
  }

  // ---------- cycles ----------

  /** PARITY: GET /api/cycles?pond= (snake param!) with the DRF pagination envelope. */
  @GetMapping("/api/cycles")
  public Map<String, Object> listCycles(@RequestParam("pond") UUID pondId,
                                        @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(pondId);
    return service.listCycles(pondId, hasAccess(principal, pond.getProjectId()));
  }

  @PostMapping("/api/ponds/{pondId}/cycles")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public ResponseEntity<CycleDto> startCycle(@PathVariable UUID pondId,
                                             @Valid @RequestBody StartCycleRequest body,
                                             @AuthenticationPrincipal SnapshotPrincipal principal) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(service.startCycle(pondId, body, principal.userId()));
  }

  @PatchMapping("/api/cycles/{cycleId}")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public CycleDto updateCycle(@PathVariable UUID cycleId, @RequestBody UpdateCycleRequest body,
                              @AuthenticationPrincipal SnapshotPrincipal principal) {
    return service.updateCycle(cycleId, body, principal.userId());
  }

  @PatchMapping({"/api/cycles/{cycleId}/biomass", "/api/cycles/{cycleId}/biomass/"})
  public Map<String, Object> updateCycleBiomass(
      @PathVariable UUID cycleId,
      @Valid @RequestBody CycleBiomassRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    UUID projectId = service.cycleProjectId(cycleId);
    requireMembership(principal, projectId);
    feeding.saveCycleBiomass(cycleId, body, principal.userId());
    return Map.of("ok", true);
  }

  /** PARITY: camelCase {cycle, stageMetrics, dailyHealth} composition. */
  @GetMapping({"/api/cycles/{cycleId}/details", "/api/cycles/{cycleId}/details/"})
  public Map<String, Object> cycleDetails(@PathVariable UUID cycleId,
                                          @AuthenticationPrincipal SnapshotPrincipal principal) {
    UUID projectId = service.cycleProjectId(cycleId);
    return service.cycleDetails(cycleId, hasAccess(principal, projectId));
  }

  // ---------- treatments ----------

  @GetMapping({"/api/treatments", "/api/treatments/"})
  public List<TreatmentDto> treatmentsCatalogue(
      @RequestParam(required = false, name = "project") UUID projectId,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    if (projectId != null) {
      requireMembership(principal, projectId);
    }
    return treatmentService.listTreatments(projectId);
  }

  @PostMapping({"/api/treatments", "/api/treatments/"})
  public ResponseEntity<TreatmentDto> createTreatment(
      @Valid @RequestBody CreateTreatmentRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, body.projectId());
    return ResponseEntity.status(HttpStatus.CREATED).body(treatmentService.createTreatment(body));
  }

  @PatchMapping({"/api/treatments/{treatmentId}", "/api/treatments/{treatmentId}/"})
  public TreatmentDto updateTreatment(
      @PathVariable UUID treatmentId,
      @Valid @RequestBody UpdateTreatmentRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, treatmentService.treatmentProjectId(treatmentId));
    return treatmentService.updateTreatment(treatmentId, body);
  }

  @DeleteMapping({"/api/treatments/{treatmentId}", "/api/treatments/{treatmentId}/"})
  public ResponseEntity<Void> deleteTreatment(
      @PathVariable UUID treatmentId,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, treatmentService.treatmentProjectId(treatmentId));
    treatmentService.deleteTreatment(treatmentId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping({"/api/pond-treatments", "/api/pond-treatments/"})
  public List<PondTreatmentDto> pondTreatments(
      @RequestParam(required = false, name = "pond") UUID pondId,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    if (pondId == null) {
      return principal.isPlatformAdmin()
          ? treatmentService.listAllCourses()
          : treatmentService.listCoursesForProjects(principal.snapshot().projectIds());
    }
    Pond pond = service.requirePond(pondId);
    requireMembership(principal, pond.getProjectId());
    return treatmentService.listCourses(pondId);
  }

  @PostMapping({"/api/pond-treatments", "/api/pond-treatments/"})
  public ResponseEntity<PondTreatmentDto> createPondTreatment(
      @Valid @RequestBody CreatePondTreatmentRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(body.pondId());
    requireMembership(principal, pond.getProjectId());
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(treatmentService.createCourse(body, principal.userId()));
  }

  @PatchMapping({"/api/pond-treatments/{courseId}", "/api/pond-treatments/{courseId}/"})
  public PondTreatmentDto updatePondTreatment(
      @PathVariable UUID courseId,
      @RequestBody JsonNode body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, treatmentService.courseProjectId(courseId));
    return treatmentService.updateCourse(courseId, body, principal.userId());
  }

  @DeleteMapping({"/api/pond-treatments/{courseId}", "/api/pond-treatments/{courseId}/"})
  public ResponseEntity<Void> deletePondTreatment(
      @PathVariable UUID courseId,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, treatmentService.courseProjectId(courseId));
    treatmentService.deleteCourse(courseId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping({"/api/pond-treatments/stability", "/api/pond-treatments/stability/"})
  public Map<String, Object> treatmentStability(
      @RequestParam("pond") UUID pondId,
      @RequestParam("courses") String courses,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(pondId);
    requireMembership(principal, pond.getProjectId());
    return treatmentService.stability(pondId, parseUuidList(courses));
  }

  // ---------- feeding & growth ----------

  @GetMapping({"/api/projects/{projectId}/feeding/options",
      "/api/projects/{projectId}/feeding/options/"})
  public Map<String, Object> feedingOptions(@PathVariable UUID projectId,
                                            @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return feeding.options(projectId);
  }

  @GetMapping({"/api/projects/{projectId}/feeding/dashboard",
      "/api/projects/{projectId}/feeding/dashboard/"})
  @SuppressWarnings("unchecked")
  public Map<String, Object> feedingDashboard(
      @PathVariable UUID projectId,
      @RequestParam(required = false) UUID pond,
      @RequestParam(required = false) UUID cycle,
      @RequestParam(required = false) UUID compare,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    if (cycle == null) {
      throw new PondAppService.BadRequest("cycle is required");
    }
    if (cycle.equals(compare)) {
      throw new PondAppService.BadRequest("compare must differ from cycle");
    }
    Map<String, Object> body = feeding.dashboard(projectId, cycle, compare);
    if (pond != null) {
      Map<String, Object> cycleBlock = (Map<String, Object>) body.get("cycle");
      if (!pond.toString().equals(cycleBlock.get("pondId"))) {
        throw new PondAppService.BadRequest("cycle does not belong to the given pond");
      }
    }
    return body;
  }

  @GetMapping({"/api/feed-types", "/api/feed-types/"})
  public List<FeedTypeRecordDto> feedTypes(@RequestParam("project") UUID projectId,
                                           @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return feeding.listFeedTypes(projectId);
  }

  @PostMapping({"/api/feed-types", "/api/feed-types/"})
  public ResponseEntity<FeedTypeRecordDto> createFeedType(
      @Valid @RequestBody CreateFeedTypeRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, body.projectId());
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(feeding.createFeedType(body, principal.userId()));
  }

  @PatchMapping({"/api/feed-types/{feedTypeId}", "/api/feed-types/{feedTypeId}/"})
  public FeedTypeRecordDto updateFeedType(
      @PathVariable UUID feedTypeId,
      @Valid @RequestBody UpdateFeedTypeRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, feeding.feedTypeProjectId(feedTypeId));
    return feeding.updateFeedType(feedTypeId, body, principal.userId());
  }

  @DeleteMapping({"/api/feed-types/{feedTypeId}", "/api/feed-types/{feedTypeId}/"})
  public ResponseEntity<Void> deleteFeedType(
      @PathVariable UUID feedTypeId,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, feeding.feedTypeProjectId(feedTypeId));
    feeding.deleteFeedType(feedTypeId);
    return ResponseEntity.noContent().build();
  }

  @PutMapping({"/api/ponds/{pondId}/feed-days/{fedOn}",
      "/api/ponds/{pondId}/feed-days/{fedOn}/"})
  public Map<String, Object> saveFeedDay(
      @PathVariable UUID pondId,
      @PathVariable String fedOn,
      @Valid @RequestBody FeedDayWriteRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(pondId);
    requireMembership(principal, pond.getProjectId());
    LocalDate fedDate = parseDate(fedOn);
    feeding.saveFeedDay(pond, fedDate, body, principal.userId());
    return Map.of("ok", true);
  }

  // ---------- pond comparison (camelCase; PARITY paths under /api/projects) ----------

  @GetMapping({"/api/projects/{projectId}/pond-comparison/ponds",
      "/api/projects/{projectId}/pond-comparison/ponds/"})
  public Map<String, Object> comparisonOptions(@PathVariable UUID projectId,
                                               @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return comparison.listPondOptions(projectId);
  }

  @GetMapping({"/api/projects/{projectId}/pond-comparison",
      "/api/projects/{projectId}/pond-comparison/"})
  public Map<String, Object> compare(@PathVariable UUID projectId,
                                     @RequestParam(required = false) String pondAId,
                                     @RequestParam(required = false) String pondBId,
                                     @RequestParam(required = false) String startDate,
                                     @RequestParam(required = false) String endDate,
                                     @RequestParam(defaultValue = "auto") String grouping,
                                     @RequestParam(required = false) String parameters,
                                     @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    // PARITY validation order + exact messages
    if (pondAId == null || pondAId.isBlank()) {
      throw new PondAppService.BadRequest("pondAId is required");
    }
    if (pondBId == null || pondBId.isBlank()) {
      throw new PondAppService.BadRequest("pondBId is required");
    }
    if (pondAId.equals(pondBId)) {
      throw new PondAppService.BadRequest("pondAId and pondBId must differ");
    }
    if (!ComparisonService.VALID_GROUPINGS.contains(grouping)) {
      throw new PondAppService.BadRequest("grouping must be one of "
          + ComparisonService.VALID_GROUPINGS.stream().sorted().toList());
    }
    LocalDate start = parseDate(startDate);
    LocalDate end = parseDate(endDate);
    if (end.isBefore(start)) {
      throw new PondAppService.BadRequest("endDate must be on or after startDate");
    }
    List<String> requestedParameters = parseParameterList(parameters);
    List<String> unknownParameters = ComparisonService.unknownParameters(requestedParameters);
    if (!unknownParameters.isEmpty()) {
      throw new PondAppService.BadRequest("Unknown parameter: "
          + String.join(", ", unknownParameters));
    }
    Pond pondA = pondInProject(pondAId, projectId);
    Pond pondB = pondInProject(pondBId, projectId);
    return comparison.compare(projectId, pondA, pondB, start, end, grouping,
        requestedParameters.isEmpty() ? null : requestedParameters);
  }

  private Pond pondInProject(String pondId, UUID projectId) {
    try {
      Pond pond = service.requirePond(UUID.fromString(pondId));
      if (!pond.getProjectId().equals(projectId)) {
        throw new PondAppService.NotFound();
      }
      return pond;
    } catch (IllegalArgumentException e) {
      throw new PondAppService.NotFound();
    } catch (PondAppService.NotFound e) {
      throw new PondNotInProject();
    }
  }

  private static LocalDate parseDate(String value) {
    if (value == null || value.isBlank()) {
      throw new PondAppService.BadRequest("Invalid date format; use YYYY-MM-DD");
    }
    try {
      return LocalDate.parse(value);
    } catch (DateTimeParseException e) {
      throw new PondAppService.BadRequest("Invalid date format; use YYYY-MM-DD");
    }
  }

  private static List<UUID> parseUuidList(String value) {
    if (value == null || value.isBlank()) {
      throw new PondAppService.BadRequest("pond and courses are required");
    }
    try {
      return List.of(value.split(",")).stream()
          .filter(item -> !item.isBlank())
          .map(UUID::fromString)
          .toList();
    } catch (IllegalArgumentException e) {
      throw new PondAppService.BadRequest("Invalid pond or course id");
    }
  }

  private static List<UUID> parseOptionalUuidList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }
    try {
      return List.of(value.split(",")).stream()
          .map(String::trim)
          .filter(item -> !item.isBlank())
          .map(UUID::fromString)
          .toList();
    } catch (IllegalArgumentException e) {
      throw new PondAppService.BadRequest("Invalid pond id");
    }
  }

  private static List<String> parseParameterList(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }
    return List.of(value.split(",")).stream()
        .map(String::trim)
        .filter(item -> !item.isBlank())
        .toList();
  }

  private static void requireMembership(SnapshotPrincipal principal, UUID projectId) {
    if (!hasAccess(principal, projectId)) {
      throw new PondAppService.NotFound();
    }
  }

  private static boolean hasAccess(SnapshotPrincipal principal, UUID projectId) {
    return principal.hasProjectAccess(projectId) || principal.isPlatformAdmin();
  }

  // ---------- error envelopes ----------

  static class PondNotInProject extends RuntimeException {}

  @ExceptionHandler(PondAppService.NotFound.class)
  ResponseEntity<Map<String, String>> notFound() {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", "Not found."));
  }

  @ExceptionHandler(PondNotInProject.class)
  ResponseEntity<Map<String, String>> pondNotInProject() {
    // PARITY: exact comparison message
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("detail", "Pond not found in this project"));
  }

  @ExceptionHandler(FeedingService.NotFoundDetail.class)
  ResponseEntity<Map<String, String>> feedingNotFound(FeedingService.NotFoundDetail e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(TreatmentService.NotFoundDetail.class)
  ResponseEntity<Map<String, String>> treatmentNotFound(TreatmentService.NotFoundDetail e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(PondAppService.BadRequest.class)
  ResponseEntity<Map<String, String>> badRequest(PondAppService.BadRequest e) {
    return ResponseEntity.badRequest().body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, String>> beanValidation(MethodArgumentNotValidException e) {
    String msg = e.getBindingResult().getFieldErrors().stream()
        .map(f -> f.getField() + ": " + f.getDefaultMessage())
        .findFirst().orElse("Validation failed");
    return ResponseEntity.badRequest().body(Map.of("detail", msg));
  }
}
