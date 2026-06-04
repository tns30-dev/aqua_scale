package com.aquashield.pond.repo;

import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.CycleDailyHealth;
import com.aquashield.pond.domain.Entities.CycleStageMetric;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Entities.Treatment;
import com.aquashield.pond.domain.Pond;
import org.springframework.data.jpa.repository.JpaRepository;

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

    Optional<Cycle> findFirstByPondIdAndStatusOrderByStartDateDesc(UUID pondId, String status);

    long countByPondId(UUID pondId);
  }

  public interface CycleDailyHealthRepository extends JpaRepository<CycleDailyHealth, UUID> {
    /** PARITY ordering: (cycle, day_number). */
    List<CycleDailyHealth> findByCycleIdOrderByDayNumberAsc(UUID cycleId);

    Optional<CycleDailyHealth> findFirstByCycleIdOrderByDayNumberDesc(UUID cycleId);
  }

  public interface CycleStageMetricRepository extends JpaRepository<CycleStageMetric, UUID> {
    List<CycleStageMetric> findByCycleIdOrderByStageNameAsc(UUID cycleId);
  }

  public interface TreatmentRepository extends JpaRepository<Treatment, UUID> {
    List<Treatment> findAllByOrderByNameAsc();
  }

  public interface PondTreatmentRepository extends JpaRepository<PondTreatment, UUID> {
    /** PARITY ordering: -started_at. */
    List<PondTreatment> findByPondIdOrderByStartedAtDesc(UUID pondId);

    List<PondTreatment> findByPondIdAndEndedAtIsNullOrderByStartedAtDesc(UUID pondId);
  }
}
