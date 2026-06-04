package com.aquashield.pond.api;

import com.aquashield.pond.api.dto.PondDtos.CreatePondRequest;
import com.aquashield.pond.api.dto.PondDtos.CycleDto;
import com.aquashield.pond.api.dto.PondDtos.PondDto;
import com.aquashield.pond.api.dto.PondDtos.PondTreatmentDto;
import com.aquashield.pond.api.dto.PondDtos.StartCycleRequest;
import com.aquashield.pond.api.dto.PondDtos.TreatmentDto;
import com.aquashield.pond.api.dto.PondDtos.UpdateCycleRequest;
import com.aquashield.pond.api.dto.PondDtos.UpdatePondRequest;
import com.aquashield.pond.config.SnapshotAuthFilter.SnapshotPrincipal;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.repo.Repos.PondTreatmentRepository;
import com.aquashield.pond.repo.Repos.TreatmentRepository;
import com.aquashield.pond.service.ComparisonService;
import com.aquashield.pond.service.HistoricalService;
import com.aquashield.pond.service.PondAppService;
import jakarta.validation.Valid;
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
 * writes = platform admin (monolith had no write API — Django-admin only).
 * Casing per endpoint preserved (snake lists, camelCase details/comparison).
 */
@RestController
public class PondController {

  private final PondAppService service;
  private final ComparisonService comparison;
  private final HistoricalService historical;
  private final TreatmentRepository treatments;
  private final PondTreatmentRepository pondTreatments;

  public PondController(PondAppService service, ComparisonService comparison,
                        HistoricalService historical,
                        TreatmentRepository treatments, PondTreatmentRepository pondTreatments) {
    this.service = service;
    this.comparison = comparison;
    this.historical = historical;
    this.treatments = treatments;
    this.pondTreatments = pondTreatments;
  }

  // ---------- ponds ----------

  /** PARITY: GET /api/ponds?projectId= -> {"ponds":[...]} (Overview/DigitalTwin feed). */
  @GetMapping("/api/ponds")
  public Map<String, Object> listPonds(@RequestParam UUID projectId,
                                       @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return service.listPonds(projectId);
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

  /** PARITY: camelCase {cycle, stageMetrics, dailyHealth} composition. */
  @GetMapping("/api/cycles/{cycleId}/details")
  public Map<String, Object> cycleDetails(@PathVariable UUID cycleId,
                                          @AuthenticationPrincipal SnapshotPrincipal principal) {
    UUID projectId = service.cycleProjectId(cycleId);
    return service.cycleDetails(cycleId, hasAccess(principal, projectId));
  }

  // ---------- treatments ----------

  /** PARITY: bare array, GLOBAL catalogue, no project scoping. */
  @GetMapping("/api/treatments")
  public List<TreatmentDto> treatmentsCatalogue() {
    return treatments.findAllByOrderByNameAsc().stream().map(TreatmentDto::from).toList();
  }

  /** PARITY: snake list filtered by ?pond= with denormalized treatment fields. */
  @GetMapping("/api/pond-treatments")
  public List<PondTreatmentDto> pondTreatments(@RequestParam("pond") UUID pondId,
                                               @AuthenticationPrincipal SnapshotPrincipal principal) {
    Pond pond = service.requirePond(pondId);
    requireMembership(principal, pond.getProjectId());
    return pondTreatments.findByPondIdOrderByStartedAtDesc(pondId).stream()
        .map(PondTreatmentDto::from).toList();
  }

  // ---------- pond comparison (camelCase; PARITY paths under /api/projects) ----------

  @GetMapping("/api/projects/{projectId}/pond-comparison/ponds")
  public Map<String, Object> comparisonOptions(@PathVariable UUID projectId,
                                               @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return comparison.listPondOptions(projectId);
  }

  @GetMapping("/api/projects/{projectId}/pond-comparison")
  public Map<String, Object> compare(@PathVariable UUID projectId,
                                     @RequestParam(required = false) String pondAId,
                                     @RequestParam(required = false) String pondBId,
                                     @RequestParam(required = false) String startDate,
                                     @RequestParam(required = false) String endDate,
                                     @RequestParam(defaultValue = "auto") String grouping,
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
    Pond pondA = pondInProject(pondAId, projectId);
    Pond pondB = pondInProject(pondBId, projectId);
    return comparison.compare(projectId, pondA, pondB, start, end, grouping);
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
