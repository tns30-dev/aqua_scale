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

  /** PARITY dedup query: per (pond, parameter_code), active rows only. */
  boolean existsByPondIdAndParameterAndAcknowledgedFalseAndResolvedFalse(
      UUID pondId, String parameter);

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

  /** PARITY list: active-only, newest first, scoped to accessible projects. */
  List<AlertLog> findByProjectIdInAndAcknowledgedFalseAndResolvedFalseOrderByTimestampDesc(
      Collection<UUID> projectIds);

  List<AlertLog> findByProjectIdInOrderByTimestampDesc(Collection<UUID> projectIds);
}
