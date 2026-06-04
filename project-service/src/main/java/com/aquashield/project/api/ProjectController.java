package com.aquashield.project.api;

import com.aquashield.project.api.dto.ProjectDtos.CreateProjectRequest;
import com.aquashield.project.api.dto.ProjectDtos.EnergySettingsDto;
import com.aquashield.project.api.dto.ProjectDtos.ParameterSettingDto;
import com.aquashield.project.api.dto.ProjectDtos.ProjectAdminItem;
import com.aquashield.project.api.dto.ProjectDtos.ProjectDto;
import com.aquashield.project.api.dto.ProjectDtos.ProjectSummaryDto;
import com.aquashield.project.api.dto.ProjectDtos.PutEnergySettingsRequest;
import com.aquashield.project.api.dto.ProjectDtos.PutParameterSettingItem;
import com.aquashield.project.api.dto.ProjectDtos.UpdateProjectRequest;
import com.aquashield.project.config.SnapshotAuthFilter.SnapshotPrincipal;
import com.aquashield.project.service.EnergyService;
import com.aquashield.project.service.ProjectAppService;
import com.aquashield.project.service.SummaryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Project endpoints. AUTHZ (parity-mapped): membership = the Redis snapshot's
 * projectIds (non-member detail => 404, like the monolith's filtered queryset —
 * admins are NOT exempt on detail routes; they use /all). /all + create = platform
 * admin. CASING per endpoint is intentional (see ProjectDtos).
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

  private final ProjectAppService projectsService;
  private final EnergyService energy;
  private final SummaryService summary;

  public ProjectController(ProjectAppService projectsService, EnergyService energy,
                           SummaryService summary) {
    this.projectsService = projectsService;
    this.energy = energy;
    this.summary = summary;
  }

  @GetMapping
  public List<ProjectDto> list(@AuthenticationPrincipal SnapshotPrincipal principal) {
    return projectsService.listAccessible(principal.snapshot().projectIds());
  }

  /** PARITY: admin view — flat camelCase, bypasses membership. */
  @GetMapping("/all")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public List<ProjectAdminItem> all() {
    return projectsService.listAll();
  }

  @PostMapping
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  public ProjectDto create(@Valid @RequestBody CreateProjectRequest body,
                           @AuthenticationPrincipal SnapshotPrincipal principal) {
    return projectsService.create(body, principal.userId());
  }

  @GetMapping("/{projectId}")
  public ProjectDto get(@PathVariable UUID projectId,
                        @AuthenticationPrincipal SnapshotPrincipal principal) {
    return projectsService.getAccessible(projectId, principal.hasProjectAccess(projectId));
  }

  @GetMapping({"/{projectId}/summary", "/{projectId}/summary/"})
  public ProjectSummaryDto getSummary(@PathVariable UUID projectId,
                                      @AuthenticationPrincipal SnapshotPrincipal principal) {
    if (!principal.hasProjectAccess(projectId)) {
      throw new ProjectAppService.NotFoundException();
    }
    return summary.getSummary(projectId);
  }

  @PatchMapping("/{projectId}")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public ProjectDto update(@PathVariable UUID projectId,
                           @RequestBody UpdateProjectRequest body,
                           @AuthenticationPrincipal SnapshotPrincipal principal) {
    return projectsService.update(projectId, body, principal.userId());
  }

  // ---------- parameter settings ----------

  @GetMapping("/{projectId}/parameter-settings")
  public List<ParameterSettingDto> getParameterSettings(
      @PathVariable UUID projectId, @AuthenticationPrincipal SnapshotPrincipal principal) {
    return projectsService.getSettings(projectId, principal.hasProjectAccess(projectId));
  }

  @PutMapping("/{projectId}/parameter-settings")
  public List<ParameterSettingDto> putParameterSettings(
      @PathVariable UUID projectId,
      @Valid @RequestBody List<PutParameterSettingItem> body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    return projectsService.putSettings(projectId, body, principal.hasProjectAccess(projectId));
  }

  // ---------- energy (camelCase; PARITY paths energy/dashboard + energy/settings) ----------

  @GetMapping({"/{projectId}/energy/dashboard", "/{projectId}/energy/dashboard/"})
  public Map<String, Object> energyDashboard(
      @PathVariable UUID projectId,
      @RequestParam(defaultValue = "day") String groupBy,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String endDate,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return energy.dashboard(projectId, groupBy, startDate, endDate);
  }

  @GetMapping({"/{projectId}/energy/settings", "/{projectId}/energy/settings/"})
  public EnergySettingsDto getEnergySettings(
      @PathVariable UUID projectId,
      @RequestParam(defaultValue = "electricity") String type,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return energy.getSettings(projectId, type);
  }

  @PutMapping({"/{projectId}/energy/settings", "/{projectId}/energy/settings/"})
  public EnergySettingsDto putEnergySettings(
      @PathVariable UUID projectId,
      @RequestParam(defaultValue = "electricity") String type,
      @RequestBody PutEnergySettingsRequest body,
      @AuthenticationPrincipal SnapshotPrincipal principal) {
    requireMembership(principal, projectId);
    return energy.putSettings(projectId, type, body, principal.userId());
  }

  private static void requireMembership(SnapshotPrincipal principal, UUID projectId) {
    if (!principal.hasProjectAccess(projectId)) {
      throw new ProjectAppService.NotFoundException(); // PARITY: 404, not 403
    }
  }
}
