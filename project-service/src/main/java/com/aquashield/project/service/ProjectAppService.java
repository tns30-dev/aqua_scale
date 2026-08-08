package com.aquashield.project.service;

import com.aquashield.project.api.dto.ProjectDtos.CreateProjectRequest;
import com.aquashield.project.api.dto.ProjectDtos.ParameterSettingDto;
import com.aquashield.project.api.dto.ProjectDtos.ProjectParameterDto;
import com.aquashield.project.api.dto.ProjectDtos.ProjectAdminItem;
import com.aquashield.project.api.dto.ProjectDtos.ProjectDto;
import com.aquashield.project.api.dto.ProjectDtos.PutParameterSettingItem;
import com.aquashield.project.api.dto.ProjectDtos.UpdateProjectRequest;
import com.aquashield.project.domain.ParameterType;
import com.aquashield.project.domain.ProfileType;
import com.aquashield.project.domain.Project;
import com.aquashield.project.domain.ProjectParameterSetting;
import com.aquashield.project.events.ProjectEventPublisher;
import com.aquashield.project.repo.Repositories.ParameterTypeRepository;
import com.aquashield.project.repo.Repositories.ProfileTypeRepository;
import com.aquashield.project.repo.Repositories.ProjectParameterSettingRepository;
import com.aquashield.project.repo.Repositories.ProjectRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Project CRUD + parameter settings (spec: main/project_service.md). */
@Service
public class ProjectAppService {

  private final ProjectRepository projects;
  private final ProfileTypeRepository profileTypes;
  private final ParameterTypeRepository parameterTypes;
  private final ProjectParameterSettingRepository settings;
  private final ProjectCache cache;
  private final ProjectEventPublisher events;
  private final ObjectMapper mapper;

  public ProjectAppService(ProjectRepository projects, ProfileTypeRepository profileTypes,
                           ParameterTypeRepository parameterTypes,
                           ProjectParameterSettingRepository settings,
                           ProjectCache cache, ProjectEventPublisher events, ObjectMapper mapper) {
    this.projects = projects;
    this.profileTypes = profileTypes;
    this.parameterTypes = parameterTypes;
    this.settings = settings;
    this.cache = cache;
    this.events = events;
    this.mapper = mapper;
  }

  /** PARITY: membership-filtered list (ACL = snapshot projectIds), newest first. */
  @Transactional(readOnly = true)
  public List<ProjectDto> listAccessible(Collection<UUID> accessibleProjectIds) {
    if (accessibleProjectIds == null || accessibleProjectIds.isEmpty()) {
      return List.of();
    }
    return projects.findByProjectIdInOrderByCreatedAtDesc(accessibleProjectIds).stream()
        .map(ProjectDto::from).toList();
  }

  /** PARITY: non-member => NotFound (404), exactly like the monolith's filtered queryset. */
  @Transactional(readOnly = true)
  public ProjectDto getAccessible(UUID projectId, boolean memberOfProject) {
    if (!memberOfProject) {
      throw new NotFoundException();
    }
    return projects.findById(projectId).map(ProjectDto::from).orElseThrow(NotFoundException::new);
  }

  /** PARITY (/all): admin-only flat camelCase, bypasses membership. */
  @Transactional(readOnly = true)
  public List<ProjectAdminItem> listAll() {
    return projects.findAllByOrderByCreatedAtDesc().stream().map(ProjectAdminItem::from).toList();
  }

  /** NET-NEW: project create (platform admin); owner defaults to the acting admin. */
  @Transactional
  public ProjectDto create(CreateProjectRequest req, UUID actingUserId) {
    ProfileType profile = profileTypes.findById(req.profileTypeId())
        .orElseThrow(() -> new BadRequestException("Unknown profileTypeId"));
    Project project = new Project();
    project.setName(req.name());
    project.setDescription(req.description());
    project.setProfileType(profile);
    project.setOwnerUserId(req.ownerUserId() != null ? req.ownerUserId() : actingUserId);
    project.setCreatedBy(actingUserId);
    project.setUpdatedBy(actingUserId);
    project = projects.save(project);
    events.publish(ProjectEventPublisher.TOPIC_CREATED, project.getProjectId(),
        payload("name", project.getName()), null);
    return ProjectDto.from(project);
  }

  @Transactional
  public ProjectDto update(UUID projectId, UpdateProjectRequest req, UUID actingUserId) {
    Project project = projects.findById(projectId).orElseThrow(NotFoundException::new);
    if (req.name() != null && !req.name().isBlank()) {
      project.setName(req.name());
    }
    if (req.description() != null) {
      project.setDescription(req.description());
    }
    project.setUpdatedBy(actingUserId);
    events.publish(ProjectEventPublisher.TOPIC_UPDATED, projectId,
        payload("name", project.getName()), null);
    return ProjectDto.from(project);
  }

  // ---------- parameter settings ----------

  @Transactional(readOnly = true)
  public List<ParameterSettingDto> getSettings(UUID projectId, boolean memberOfProject) {
    if (!memberOfProject) {
      throw new NotFoundException();
    }
    requireProject(projectId);
    return settings.findByProjectId(projectId).stream().map(ParameterSettingDto::from).toList();
  }

  @Transactional(readOnly = true)
  public List<ProjectParameterDto> getProjectParameters(UUID projectId, boolean memberOfProject) {
    if (!memberOfProject) {
      throw new NotFoundException();
    }
    requireProject(projectId);
    return settings.findByProjectId(projectId).stream()
        .filter(s -> s.getParameter().getParameterCode() != null)
        .filter(s -> !"electricity".equals(s.getParameter().getParameterCode()))
        .sorted((a, b) -> a.getParameter().getParameterName()
            .compareToIgnoreCase(b.getParameter().getParameterName()))
        .map(ProjectParameterDto::from)
        .toList();
  }

  /**
   * NET-NEW REST (monolith managed thresholds via admin only): upsert by parameter_code,
   * preserving UNIQUE(project,parameter). Settings cache invalidated + event published
   * so Notification's threshold cache refreshes (main/redis.md invalidation pair).
   */
  @Transactional
  public List<ParameterSettingDto> putSettings(UUID projectId, List<PutParameterSettingItem> items,
                                               boolean memberOfProject) {
    if (!memberOfProject) {
      throw new NotFoundException();
    }
    requireProject(projectId);
    Map<String, ProjectParameterSetting> existing = new HashMap<>();
    for (ProjectParameterSetting s : settings.findByProjectId(projectId)) {
      existing.put(s.getParameter().getParameterCode(), s);
    }
    List<ProjectParameterSetting> result = new ArrayList<>();
    for (PutParameterSettingItem item : items) {
      ProjectParameterSetting setting = existing.get(item.parameterCode());
      if (setting == null) {
        ParameterType parameter = parameterTypes.findByParameterCode(item.parameterCode())
            .orElseThrow(() -> new BadRequestException(
                "Unknown parameter_code: " + item.parameterCode()));
        setting = new ProjectParameterSetting(projectId, parameter, item.minThreshold(),
            item.maxThreshold(), Boolean.TRUE.equals(item.isKeyParameter()));
      } else {
        setting.setMinThreshold(item.minThreshold());
        setting.setMaxThreshold(item.maxThreshold());
        if (item.isKeyParameter() != null) {
          setting.setKeyParameter(item.isKeyParameter());
        }
      }
      result.add(settings.save(setting));
    }
    cache.invalidateSettings(projectId);
    events.publish(ProjectEventPublisher.TOPIC_SETTINGS_UPDATED, projectId,
        payload("updatedParameters", String.valueOf(items.size())), null);
    return result.stream().map(ParameterSettingDto::from).toList();
  }

  private void requireProject(UUID projectId) {
    if (!projects.existsById(projectId)) {
      throw new NotFoundException();
    }
  }

  private ObjectNode payload(String key, String value) {
    return mapper.createObjectNode().put(key, value);
  }

  public static class NotFoundException extends RuntimeException {}

  public static class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
      super(message);
    }
  }
}
