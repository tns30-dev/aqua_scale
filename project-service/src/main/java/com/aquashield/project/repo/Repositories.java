package com.aquashield.project.repo;

import com.aquashield.project.domain.GrowthIndicator;
import com.aquashield.project.domain.ParameterType;
import com.aquashield.project.domain.ProfileType;
import com.aquashield.project.domain.Project;
import com.aquashield.project.domain.ProjectEnergySetting;
import com.aquashield.project.domain.ProjectParameterSetting;
import com.aquashield.project.domain.ProjectVisualisation;
import com.aquashield.project.domain.VisualisationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Spring Data repositories (parity orderings encoded in method names). */
public final class Repositories {

  private Repositories() {}

  public interface ProjectRepository extends JpaRepository<Project, UUID> {
    /** PARITY: Project.Meta.ordering = -created_at */
    List<Project> findByProjectIdInOrderByCreatedAtDesc(Collection<UUID> ids);

    List<Project> findAllByOrderByCreatedAtDesc();
  }

  public interface ProfileTypeRepository extends JpaRepository<ProfileType, UUID> {
    /** PARITY: catalogue ordered by code */
    List<ProfileType> findAllByOrderByCodeAsc();
  }

  public interface ParameterTypeRepository extends JpaRepository<ParameterType, UUID> {
    /** PARITY: ordering = parameter_code */
    List<ParameterType> findAllByOrderByParameterCodeAsc();

    Optional<ParameterType> findByParameterCode(String parameterCode);
  }

  public interface GrowthIndicatorRepository extends JpaRepository<GrowthIndicator, UUID> {
    List<GrowthIndicator> findAllByOrderByCodeAsc();
  }

  public interface ProjectParameterSettingRepository
      extends JpaRepository<ProjectParameterSetting, UUID> {
    List<ProjectParameterSetting> findByProjectId(UUID projectId);

    Optional<ProjectParameterSetting> findByProjectIdAndParameterParameterCode(
        UUID projectId, String parameterCode);
  }

  public interface ProjectEnergySettingRepository
      extends JpaRepository<ProjectEnergySetting, UUID> {
    Optional<ProjectEnergySetting> findByProjectIdAndType(UUID projectId, String type);
  }

  public interface VisualisationTypeRepository extends JpaRepository<VisualisationType, UUID> {
    Optional<VisualisationType> findByName(String name);
  }

  public interface ProjectVisualisationRepository
      extends JpaRepository<ProjectVisualisation, UUID> {
    /** PARITY: the chart engine reads enabled rows only (enabled=True filter). */
    List<ProjectVisualisation> findByProjectIdAndEnabledTrue(UUID projectId);
  }
}
