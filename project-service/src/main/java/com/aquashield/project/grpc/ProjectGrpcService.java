package com.aquashield.project.grpc;

import com.aquashield.api.project.v1.ChartConfigEntry;
import com.aquashield.api.project.v1.GetChartConfigRequest;
import com.aquashield.api.project.v1.GetChartConfigResponse;
import com.aquashield.api.project.v1.GetParameterCatalogueRequest;
import com.aquashield.api.project.v1.GetParameterCatalogueResponse;
import com.aquashield.api.project.v1.GetParameterSettingsRequest;
import com.aquashield.api.project.v1.GetParameterSettingsResponse;
import com.aquashield.api.project.v1.GetProfileTypeRequest;
import com.aquashield.api.project.v1.GetProjectRequest;
import com.aquashield.api.project.v1.ParameterSetting;
import com.aquashield.api.project.v1.ParameterTypeInfo;
import com.aquashield.api.project.v1.ProfileType;
import com.aquashield.api.project.v1.Project;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.api.project.v1.ValidateProjectAccessRequest;
import com.aquashield.api.project.v1.ValidateProjectAccessResponse;
import com.aquashield.project.repo.Repositories.ParameterTypeRepository;
import com.aquashield.project.repo.Repositories.ProfileTypeRepository;
import com.aquashield.project.repo.Repositories.ProjectParameterSettingRepository;
import com.aquashield.project.repo.Repositories.ProjectRepository;
import com.aquashield.project.repo.Repositories.ProjectVisualisationRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Internal gRPC API (spec: main/project_service.md gRPC Contract Checklist).
 * Hot consumer: Notification's threshold evaluation — PARITY: settings are keyed by
 * parameter_code (the monolith's ParameterType.name alias), never the display name.
 * In-cluster only (NetworkPolicy + mesh mTLS).
 */
@Service
public class ProjectGrpcService extends ProjectServiceGrpc.ProjectServiceImplBase {

  private final ProjectRepository projects;
  private final ProfileTypeRepository profileTypes;
  private final ParameterTypeRepository parameterTypes;
  private final ProjectParameterSettingRepository settings;
  private final ProjectVisualisationRepository visualisations;

  public ProjectGrpcService(ProjectRepository projects, ProfileTypeRepository profileTypes,
                            ParameterTypeRepository parameterTypes,
                            ProjectParameterSettingRepository settings,
                            ProjectVisualisationRepository visualisations) {
    this.projects = projects;
    this.profileTypes = profileTypes;
    this.parameterTypes = parameterTypes;
    this.settings = settings;
    this.visualisations = visualisations;
  }

  @Override
  @Transactional(readOnly = true)
  public void getProject(GetProjectRequest request, StreamObserver<Project> observer) {
    UUID id = parseUuid(request.getProjectId(), observer);
    if (id == null) {
      return;
    }
    var project = projects.findById(id).orElse(null);
    if (project == null) {
      observer.onError(Status.NOT_FOUND.withDescription("Project not found").asRuntimeException());
      return;
    }
    observer.onNext(Project.newBuilder()
        .setProjectId(project.getProjectId().toString())
        .setName(project.getName())
        .setProfileTypeId(project.getProfileType().getProfileTypeId().toString())
        .setProfileTypeCode(nullSafe(project.getProfileType().getCode()))
        .setOwnerUserId(project.getOwnerUserId().toString())
        .setStatus("active")
        .build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getProfileType(GetProfileTypeRequest request, StreamObserver<ProfileType> observer) {
    UUID id = parseUuid(request.getProfileTypeId(), observer);
    if (id == null) {
      return;
    }
    var profile = profileTypes.findById(id).orElse(null);
    if (profile == null) {
      observer.onError(Status.NOT_FOUND.withDescription("ProfileType not found").asRuntimeException());
      return;
    }
    ProfileType.Builder builder = ProfileType.newBuilder()
        .setProfileTypeId(profile.getProfileTypeId().toString())
        .setCode(nullSafe(profile.getCode()))
        .setName(profile.getName())
        .setStageConfigJson(profile.getStageConfig() == null ? "" : profile.getStageConfig().toString())
        .setThemeJson(profile.getTheme() == null ? "" : profile.getTheme().toString());
    if (profile.getKeyParameterIndicators() != null) {
      builder.addAllKeyParameterCodes(profile.getKeyParameterIndicators());
    }
    if (profile.getKeyGrowthIndicators() != null) {
      builder.addAllKeyGrowthIndicatorCodes(profile.getKeyGrowthIndicators());
    }
    observer.onNext(builder.build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getParameterSettings(GetParameterSettingsRequest request,
                                   StreamObserver<GetParameterSettingsResponse> observer) {
    UUID id = parseUuid(request.getProjectId(), observer);
    if (id == null) {
      return;
    }
    GetParameterSettingsResponse.Builder resp =
        GetParameterSettingsResponse.newBuilder().setProjectId(request.getProjectId());
    for (var s : settings.findByProjectId(id)) {
      // PARITY: filter + key by parameter_code (the threshold engine's map key)
      String code = s.getParameter().thresholdKey();
      if (!request.getParameterCode().isEmpty() && !request.getParameterCode().equals(code)) {
        continue;
      }
      ParameterSetting.Builder ps = ParameterSetting.newBuilder()
          .setParameterCode(code)
          .setParameterName(s.getParameter().getParameterName())
          .setUnit(nullSafe(s.getParameter().getUnit()))
          .setKeyParameter(s.isKeyParameter())
          .setHasMin(s.getMinThreshold() != null)
          .setHasMax(s.getMaxThreshold() != null);
      if (s.getMinThreshold() != null) {
        ps.setMinValue(s.getMinThreshold());
      }
      if (s.getMaxThreshold() != null) {
        ps.setMaxValue(s.getMaxThreshold());
      }
      resp.addSettings(ps);
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getParameterCatalogue(GetParameterCatalogueRequest request,
                                    StreamObserver<GetParameterCatalogueResponse> observer) {
    GetParameterCatalogueResponse.Builder resp = GetParameterCatalogueResponse.newBuilder();
    for (var p : parameterTypes.findAllByOrderByParameterCodeAsc()) {
      resp.addParameters(ParameterTypeInfo.newBuilder()
          .setParameterTypeId(p.getParameterId().toString())
          .setCode(p.getParameterCode())
          .setName(p.getParameterName())
          .setUnit(nullSafe(p.getUnit())));
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void validateProjectAccess(ValidateProjectAccessRequest request,
                                    StreamObserver<ValidateProjectAccessResponse> observer) {
    ValidateProjectAccessResponse.Builder resp = ValidateProjectAccessResponse.newBuilder();
    try {
      var project = projects.findById(UUID.fromString(request.getProjectId())).orElse(null);
      if (project != null) {
        resp.setExists(true).setProfileTypeCode(nullSafe(project.getProfileType().getCode()));
      }
    } catch (IllegalArgumentException ignored) {
      // malformed id -> exists=false
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getChartConfig(GetChartConfigRequest request,
                             StreamObserver<GetChartConfigResponse> observer) {
    UUID id = parseUuid(request.getProjectId(), observer);
    if (id == null) {
      return;
    }
    GetChartConfigResponse.Builder resp =
        GetChartConfigResponse.newBuilder().setProjectId(request.getProjectId());
    for (var vis : visualisations.findByProjectIdAndEnabledTrue(id)) {
      ChartConfigEntry.Builder entry = ChartConfigEntry.newBuilder()
          .setProjectVisualisationId(vis.getProjectVisualisationId().toString())
          .setVisualisationName(vis.getVisualisationType().getName())
          .setChartType(nullSafe(vis.getVisualisationType().getChartType()))
          .setTitle(nullSafe(vis.getTitle()));
      if (vis.getYParameters() != null) {
        // PARITY: resolve y_parameters UUIDs -> parameter_code; unknown ids drop out
        // silently (the monolith's filter(parameter_id__in=...) does the same).
        for (UUID parameterId : vis.getYParameters()) {
          parameterTypes.findById(parameterId)
              .ifPresent(p -> entry.addYParameterCodes(p.getParameterCode()));
        }
      }
      resp.addCharts(entry);
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  private static UUID parseUuid(String value, StreamObserver<?> observer) {
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid id").asRuntimeException());
      return null;
    }
  }

  private static String nullSafe(String value) {
    return value == null ? "" : value;
  }
}
