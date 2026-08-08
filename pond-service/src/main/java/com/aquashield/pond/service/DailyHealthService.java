package com.aquashield.pond.service;

import com.aquashield.api.notification.v1.GetPondAlertCountsRequest;
import com.aquashield.api.notification.v1.NotificationServiceGrpc;
import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.CycleDailyHealth;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.repo.Repos.CycleDailyHealthRepository;
import com.aquashield.pond.repo.Repos.CycleRepository;
import com.aquashield.pond.repo.Repos.PondRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Daily cycle health projection. Mirrors the second-round monolith scheduler while keeping
 * alert-log ownership inside notification-service.
 */
@Service
public class DailyHealthService {

  static final int DB_DAY_NUMBER_CAP = 200;
  private static final long POOR_MIN_ALERTS = 3;
  private static final long FAIR_MIN_ALERTS = 2;
  private static final long GOOD_MIN_ALERTS = 1;
  private static final long GOOD_MIN_WARNINGS = 2;
  private static final AlertCounts ZERO_COUNTS = new AlertCounts(0, 0);

  private final CycleRepository cycles;
  private final PondRepository ponds;
  private final CycleDailyHealthRepository dailyHealth;
  private final StageResolver stageResolver;
  private final NotificationServiceGrpc.NotificationServiceBlockingStub notifications;
  private final ZoneId zone;

  public DailyHealthService(
      CycleRepository cycles,
      PondRepository ponds,
      CycleDailyHealthRepository dailyHealth,
      StageResolver stageResolver,
      NotificationServiceGrpc.NotificationServiceBlockingStub notifications,
      @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.cycles = cycles;
    this.ponds = ponds;
    this.dailyHealth = dailyHealth;
    this.stageResolver = stageResolver;
    this.notifications = notifications;
    this.zone = ZoneId.of(timezone);
  }

  @Transactional
  public DailyHealthSummary compute(LocalDate targetDate) {
    List<Cycle> activeCycles = cycles.findActiveOn(targetDate);
    int cyclesSeen = activeCycles.size();
    if (activeCycles.isEmpty()) {
      return new DailyHealthSummary(targetDate, 0, 0, 0, 0);
    }

    Map<UUID, Pond> pondsById = loadPonds(activeCycles);
    Map<UUID, AlertCounts> countsByPond = loadAlertCounts(targetDate, activeCycles, pondsById);
    Map<CycleDay, CycleDailyHealth> existingRows = loadExistingRows(targetDate, activeCycles);
    Map<UUID, StageResolver.ProjectContext> contextsByProject = new HashMap<>();

    List<CycleDailyHealth> writes = new ArrayList<>();
    int skippedHumanEdited = 0;
    int skippedOutOfRange = 0;

    for (Cycle cycle : activeCycles) {
      Pond pond = pondsById.get(cycle.getPondId());
      if (pond == null) {
        continue;
      }

      int dayNumber = dayNumber(cycle, targetDate);
      StageResolver.ProjectContext context = contextsByProject.computeIfAbsent(
          pond.getProjectId(), stageResolver::forProject);
      if (dayNumber > dayNumberCap(context)) {
        skippedOutOfRange++;
        continue;
      }

      CycleDay key = new CycleDay(cycle.getCycleId(), dayNumber);
      CycleDailyHealth row = existingRows.get(key);
      if (row != null && row.isHumanEdited()) {
        skippedHumanEdited++;
        continue;
      }

      AlertCounts counts = countsByPond.getOrDefault(cycle.getPondId(), ZERO_COUNTS);
      String status = deriveStatus(counts.alerts(), counts.warnings());
      int alertCount = clampCount(counts.alerts());
      if (row == null) {
        row = new CycleDailyHealth(cycle.getCycleId(), dayNumber, targetDate, status, alertCount);
      } else {
        row.setDate(targetDate);
        row.setHealthStatus(status);
        row.setAlertCount(alertCount);
      }
      writes.add(row);
    }

    if (!writes.isEmpty()) {
      dailyHealth.saveAll(writes);
    }

    return new DailyHealthSummary(
        targetDate, cyclesSeen, writes.size(), skippedHumanEdited, skippedOutOfRange);
  }

  static String deriveStatus(long alerts, long warnings) {
    if (alerts >= POOR_MIN_ALERTS) {
      return "poor";
    }
    if (alerts >= FAIR_MIN_ALERTS) {
      return "fair";
    }
    if (alerts >= GOOD_MIN_ALERTS) {
      return "good";
    }
    if (warnings >= GOOD_MIN_WARNINGS) {
      return "good";
    }
    return "excellent";
  }

  static int dayNumberCap(StageResolver.ProjectContext context) {
    int maxEndDay = 0;
    for (JsonNode stage : context.stages()) {
      JsonNode end = stage.get("endDay");
      if (end != null && end.canConvertToInt() && end.asInt() > maxEndDay) {
        maxEndDay = end.asInt();
      }
    }
    return maxEndDay > 0 ? Math.min(maxEndDay, DB_DAY_NUMBER_CAP) : DB_DAY_NUMBER_CAP;
  }

  private Map<UUID, Pond> loadPonds(List<Cycle> activeCycles) {
    Set<UUID> pondIds = activeCycles.stream()
        .map(Cycle::getPondId)
        .collect(Collectors.toCollection(HashSet::new));
    return ponds.findAllById(pondIds).stream()
        .collect(Collectors.toMap(Pond::getPondId, pond -> pond));
  }

  private Map<UUID, AlertCounts> loadAlertCounts(
      LocalDate targetDate, Collection<Cycle> activeCycles, Map<UUID, Pond> pondsById) {
    OffsetDateTime start = targetDate.atStartOfDay(zone).toOffsetDateTime();
    OffsetDateTime end = targetDate.plusDays(1).atStartOfDay(zone).toOffsetDateTime();
    Map<UUID, Set<UUID>> pondIdsByProject = new LinkedHashMap<>();
    for (Cycle cycle : activeCycles) {
      Pond pond = pondsById.get(cycle.getPondId());
      if (pond != null) {
        pondIdsByProject.computeIfAbsent(pond.getProjectId(), ignored -> new HashSet<>())
            .add(pond.getPondId());
      }
    }

    Map<UUID, AlertCounts> countsByPond = new HashMap<>();
    for (var entry : pondIdsByProject.entrySet()) {
      GetPondAlertCountsRequest request = GetPondAlertCountsRequest.newBuilder()
          .setProjectId(entry.getKey().toString())
          .addAllPondIds(entry.getValue().stream().map(UUID::toString).toList())
          .setStartAt(start.toString())
          .setEndAt(end.toString())
          .build();
      var response = notifications.getPondAlertCounts(request);
      for (var count : response.getCountsList()) {
        countsByPond.put(UUID.fromString(count.getPondId()),
            new AlertCounts(count.getAlertCount(), count.getWarningCount()));
      }
    }
    return countsByPond;
  }

  private Map<CycleDay, CycleDailyHealth> loadExistingRows(
      LocalDate targetDate, List<Cycle> activeCycles) {
    List<UUID> cycleIds = new ArrayList<>(activeCycles.size());
    Set<Integer> dayNumbers = new HashSet<>();
    for (Cycle cycle : activeCycles) {
      cycleIds.add(cycle.getCycleId());
      dayNumbers.add(dayNumber(cycle, targetDate));
    }
    return dailyHealth.findByCycleIdInAndDayNumberIn(cycleIds, dayNumbers).stream()
        .collect(Collectors.toMap(
            row -> new CycleDay(row.getCycleId(), row.getDayNumber()),
            row -> row,
            (left, right) -> left));
  }

  private static int dayNumber(Cycle cycle, LocalDate targetDate) {
    return (int) ChronoUnit.DAYS.between(cycle.getStartDate(), targetDate) + 1;
  }

  private static int clampCount(long count) {
    return count > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) count;
  }

  private record AlertCounts(long alerts, long warnings) {}

  private record CycleDay(UUID cycleId, int dayNumber) {}

  public record DailyHealthSummary(
      LocalDate targetDate,
      int cyclesSeen,
      int written,
      int skippedHumanEdited,
      int skippedOutOfRange) {

    public String asLogLine() {
      return "target_date=" + targetDate
          + " cycles_seen=" + cyclesSeen
          + " written=" + written
          + " skipped_human_edited=" + skippedHumanEdited
          + " skipped_out_of_range=" + skippedOutOfRange;
    }
  }
}
