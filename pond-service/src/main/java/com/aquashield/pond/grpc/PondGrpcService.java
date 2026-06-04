package com.aquashield.pond.grpc;

import com.aquashield.api.pond.v1.Cycle;
import com.aquashield.api.pond.v1.GetCurrentCycleRequest;
import com.aquashield.api.pond.v1.GetPondRequest;
import com.aquashield.api.pond.v1.GetPondSummaryRequest;
import com.aquashield.api.pond.v1.GetPondsByProjectRequest;
import com.aquashield.api.pond.v1.GetPondsByProjectResponse;
import com.aquashield.api.pond.v1.Pond;
import com.aquashield.api.pond.v1.PondSummary;
import com.aquashield.api.pond.v1.PondServiceGrpc;
import com.aquashield.api.pond.v1.ValidatePondInProjectRequest;
import com.aquashield.api.pond.v1.ValidatePondInProjectResponse;
import com.aquashield.pond.repo.Repos.CycleDailyHealthRepository;
import com.aquashield.pond.repo.Repos.CycleRepository;
import com.aquashield.pond.repo.Repos.PondRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Internal gRPC (spec: main/pond_service.md). Consumers: Ingestion/Notification need
 * GetPond (name + projectId routing context); Project composes cycle views; Realtime
 * authorizes pond subscriptions. In-cluster only.
 */
@Service
public class PondGrpcService extends PondServiceGrpc.PondServiceImplBase {

  private final PondRepository ponds;
  private final CycleRepository cycles;
  private final CycleDailyHealthRepository dailyHealth;

  public PondGrpcService(PondRepository ponds, CycleRepository cycles,
                         CycleDailyHealthRepository dailyHealth) {
    this.ponds = ponds;
    this.cycles = cycles;
    this.dailyHealth = dailyHealth;
  }

  @Override
  @Transactional(readOnly = true)
  public void getPond(GetPondRequest request, StreamObserver<Pond> observer) {
    var pond = find(request.getPondId(), observer);
    if (pond == null) {
      return;
    }
    observer.onNext(toProto(pond));
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getPondsByProject(GetPondsByProjectRequest request,
                                StreamObserver<GetPondsByProjectResponse> observer) {
    try {
      GetPondsByProjectResponse.Builder resp = GetPondsByProjectResponse.newBuilder();
      ponds.findByProjectIdOrderByNameAsc(UUID.fromString(request.getProjectId()))
          .forEach(p -> resp.addPonds(toProto(p)));
      observer.onNext(resp.build());
      observer.onCompleted();
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid id").asRuntimeException());
    }
  }

  @Override
  @Transactional(readOnly = true)
  public void getCurrentCycle(GetCurrentCycleRequest request, StreamObserver<Cycle> observer) {
    try {
      var cycle = cycles.findFirstByPondIdAndStatusOrderByStartDateDesc(
          UUID.fromString(request.getPondId()), "ongoing").orElse(null);
      if (cycle == null) {
        observer.onError(Status.NOT_FOUND.withDescription("No ongoing cycle").asRuntimeException());
        return;
      }
      observer.onNext(toProto(cycle));
      observer.onCompleted();
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid id").asRuntimeException());
    }
  }

  @Override
  @Transactional(readOnly = true)
  public void validatePondInProject(ValidatePondInProjectRequest request,
                                    StreamObserver<ValidatePondInProjectResponse> observer) {
    boolean valid = false;
    try {
      var pond = ponds.findById(UUID.fromString(request.getPondId())).orElse(null);
      valid = pond != null && pond.getProjectId().toString().equals(request.getProjectId());
    } catch (IllegalArgumentException ignored) {
      // malformed ids -> invalid
    }
    observer.onNext(ValidatePondInProjectResponse.newBuilder().setValid(valid).build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getPondSummary(GetPondSummaryRequest request, StreamObserver<PondSummary> observer) {
    var pond = find(request.getPondId(), observer);
    if (pond == null) {
      return;
    }
    PondSummary.Builder resp = PondSummary.newBuilder()
        .setPond(toProto(pond))
        .setTotalCycles((int) cycles.countByPondId(pond.getPondId()));
    var current = cycles.findFirstByPondIdAndStatusOrderByStartDateDesc(
        pond.getPondId(), "ongoing").orElse(null);
    if (current != null) {
      resp.setHasActiveCycle(true).setCurrentCycle(toProto(current));
      dailyHealth.findFirstByCycleIdOrderByDayNumberDesc(current.getCycleId())
          .ifPresent(h -> resp.setLatestHealthStatus(
              h.getHealthStatus() == null ? "" : h.getHealthStatus()));
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  private com.aquashield.pond.domain.Pond find(String pondId, StreamObserver<?> observer) {
    try {
      var pond = ponds.findById(UUID.fromString(pondId)).orElse(null);
      if (pond == null) {
        observer.onError(Status.NOT_FOUND.withDescription("Pond not found").asRuntimeException());
      }
      return pond;
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid id").asRuntimeException());
      return null;
    }
  }

  private static Pond toProto(com.aquashield.pond.domain.Pond p) {
    return Pond.newBuilder()
        .setPondId(p.getPondId().toString())
        .setProjectId(p.getProjectId().toString())
        .setName(p.getName())
        .setStatus(p.getStatus())
        .build();
  }

  private static Cycle toProto(com.aquashield.pond.domain.Cycle c) {
    Cycle.Builder builder = Cycle.newBuilder()
        .setCycleId(c.getCycleId().toString())
        .setPondId(c.getPondId().toString())
        .setStatus(c.getStatus())
        .setStartDate(c.getStartDate().toString())
        .setCurrentDay(c.currentDay(LocalDate.now()));
    if (c.getEndDate() != null) {
      builder.setEndDate(c.getEndDate().toString());
    }
    return builder.build();
  }
}
