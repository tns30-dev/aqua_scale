package com.aquashield.pond.repo;

import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.CycleDailyHealth;
import com.aquashield.pond.domain.Entities.CycleStageMetric;
import com.aquashield.pond.domain.Entities.FeedLog;
import com.aquashield.pond.domain.Entities.FeedType;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Entities.Treatment;
import com.aquashield.pond.domain.Pond;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public final class Repos {

  private Repos() {}

  public interface PondRepository extends JpaRepository<Pond, UUID> {
    /** PARITY: Pond ordering = name. */
    List<Pond> findByProjectIdOrderByNameAsc(UUID projectId);
  }

  public interface CycleRepository extends JpaRepository<Cycle, UUID> {
    /** PARITY: Cycle ordering = -start_date; get_active_cycle = first ongoing. */
    List<Cycle> findByPondIdOrderByStartDateDesc(UUID pondId);

    List<Cycle> findByPondIdOrderByStartDateAsc(UUID pondId);

    Optional<Cycle> findFirstByPondIdAndStatusOrderByStartDateDesc(UUID pondId, String status);

    Optional<Cycle> findFirstByPondIdAndStatusAndStartDateLessThanEqualOrderByStartDateDesc(
        UUID pondId, String status, LocalDate startDate);

    long countByPondId(UUID pondId);

    @Query("""
        select c from Cycle c
        where c.status = 'ongoing'
          and c.startDate <= :target
          and (c.endDate is null or c.endDate >= :target)
        """)
    List<Cycle> findActiveOn(@Param("target") LocalDate target);
  }

  public interface CycleDailyHealthRepository extends JpaRepository<CycleDailyHealth, UUID> {
    /** PARITY ordering: (cycle, day_number). */
    List<CycleDailyHealth> findByCycleIdOrderByDayNumberAsc(UUID cycleId);

    Optional<CycleDailyHealth> findFirstByCycleIdOrderByDayNumberDesc(UUID cycleId);

    List<CycleDailyHealth> findByCycleIdInAndDayNumberIn(
        Collection<UUID> cycleIds, Collection<Integer> dayNumbers);
  }

  public interface CycleStageMetricRepository extends JpaRepository<CycleStageMetric, UUID> {
    List<CycleStageMetric> findByCycleIdOrderByStageNameAsc(UUID cycleId);
  }

  public interface TreatmentRepository extends JpaRepository<Treatment, UUID> {
    List<Treatment> findAllByOrderByNameAsc();

    List<Treatment> findByProjectIdOrProjectIdIsNullOrderByNameAsc(UUID projectId);

    List<Treatment> findByProjectIdOrderByNameAsc(UUID projectId);

    Optional<Treatment> findByProjectIdAndName(UUID projectId, String name);

    boolean existsByProjectIdAndNameAndTreatmentIdNot(
        UUID projectId, String name, UUID treatmentId);

    boolean existsByProjectIdAndCode(UUID projectId, String code);
  }

  public interface PondTreatmentRepository extends JpaRepository<PondTreatment, UUID> {
    /** PARITY ordering: -started_at. */
    List<PondTreatment> findByPondIdOrderByStartedAtDesc(UUID pondId);

    List<PondTreatment> findByPondIdAndEndedAtIsNullOrderByStartedAtDesc(UUID pondId);

    List<PondTreatment> findByPondIdAndStartedAtLessThanEqualOrderByStartedAtAsc(
        UUID pondId, LocalDate windowEnd);

    List<PondTreatment> findByPondIdInOrderByStartedAtDesc(List<UUID> pondIds);

    List<PondTreatment> findByPondIdAndPondTreatmentIdInOrderByStartedAtDesc(
        UUID pondId, List<UUID> pondTreatmentIds);

    long countByTreatmentTreatmentId(UUID treatmentId);
  }

  public interface FeedTypeRepository extends JpaRepository<FeedType, UUID> {
    List<FeedType> findByProjectIdOrderByNameAsc(UUID projectId);

    List<FeedType> findByProjectIdAndActiveTrueOrderByNameAsc(UUID projectId);

    Optional<FeedType> findByProjectIdAndName(UUID projectId, String name);

    boolean existsByProjectIdAndNameAndFeedTypeIdNot(UUID projectId, String name, UUID feedTypeId);
  }

  public interface FeedLogRepository extends JpaRepository<FeedLog, UUID> {
    List<FeedLog> findByPondIdIn(List<UUID> pondIds);

    List<FeedLog> findByPondIdAndFedOnBetweenOrderByFedOnAscCreatedAtAsc(
        UUID pondId, LocalDate start, LocalDate end);

    List<FeedLog> findByPondIdAndFedOnOrderByCreatedAtAsc(UUID pondId, LocalDate fedOn);

    long countByFeedTypeFeedTypeId(UUID feedTypeId);
  }
}
