package com.aquashield.notification.repo;

import com.aquashield.notification.domain.AlertLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AlertLogRepository extends JpaRepository<AlertLog, UUID> {

  interface PondAlertCountRow {
    UUID getPondId();
    String getLogType();
    long getCount();
  }

  /** PARITY dedup query: per (pond, parameter_code), active rows only. */
  boolean existsByPondIdAndParameterAndAcknowledgedFalseAndResolvedFalse(
      UUID pondId, String parameter);

  boolean existsByProjectIdAndPondIdIsNullAndParameterAndAcknowledgedFalseAndResolvedFalse(
      UUID projectId, String parameter);

  java.util.Optional<AlertLog> findFirstByProjectIdAndPondIdIsNullAndParameterAndReadingTimestampGreaterThanEqualAndReadingTimestampLessThan(
      UUID projectId, String parameter, OffsetDateTime start, OffsetDateTime end);

  /** PARITY (project summary): active = unacknowledged AND unresolved. */
  long countByProjectIdAndAcknowledgedFalseAndResolvedFalse(UUID projectId);

  /**
   * PARITY auto-resolve: bulk resolved=true on active rows for (pond, parameter).
   * DIVERGENCE (improvement): also stamps resolved_at (column existed unused).
   */
  @org.springframework.transaction.annotation.Transactional
  @Modifying
  @Query("update AlertLog a set a.resolved = true, a.resolvedAt = :at "
      + "where a.pondId = :pondId and a.parameter = :parameter "
      + "and a.acknowledged = false and a.resolved = false")
  int autoResolve(@Param("pondId") UUID pondId, @Param("parameter") String parameter,
                  @Param("at") OffsetDateTime at);

  @org.springframework.transaction.annotation.Transactional
  @Modifying
  @Query("update AlertLog a set a.resolved = true, a.resolvedAt = :at "
      + "where a.projectId = :projectId and a.pondId is null and a.parameter = :parameter "
      + "and a.acknowledged = false and a.resolved = false")
  int autoResolveEnergy(@Param("projectId") UUID projectId, @Param("parameter") String parameter,
                        @Param("at") OffsetDateTime at);

  /** PARITY list: active-only, newest first, scoped to accessible projects. */
  List<AlertLog> findByProjectIdInAndAcknowledgedFalseAndResolvedFalseOrderByTimestampDesc(
      Collection<UUID> projectIds);

  List<AlertLog> findByProjectIdInOrderByTimestampDesc(Collection<UUID> projectIds);

  List<AlertLog> findByProjectIdInAndTimestampBetweenOrderByTimestampDesc(
      Collection<UUID> projectIds, OffsetDateTime start, OffsetDateTime end);

  @Query("""
      select a.pondId as pondId, a.logType as logType, count(a) as count
      from AlertLog a
      where a.projectId = :projectId
        and a.pondId in :pondIds
        and a.timestamp >= :start
        and a.timestamp < :end
      group by a.pondId, a.logType
      """)
  List<PondAlertCountRow> countByPondAndLogType(
      @Param("projectId") UUID projectId,
      @Param("pondIds") Collection<UUID> pondIds,
      @Param("start") OffsetDateTime start,
      @Param("end") OffsetDateTime end);
}
