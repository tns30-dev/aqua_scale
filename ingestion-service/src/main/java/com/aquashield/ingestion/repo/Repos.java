package com.aquashield.ingestion.repo;

import com.aquashield.ingestion.domain.Entities.SensorMessage;
import com.aquashield.ingestion.domain.Entities.SensorReadingRow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public final class Repos {

  private Repos() {}

  public interface SensorMessageRepository extends JpaRepository<SensorMessage, UUID> {
    boolean existsByIotDeviceIdAndSeqNo(UUID iotDeviceId, long seqNo);
  }

  public interface SensorReadingRepository extends JpaRepository<SensorReadingRow, UUID> {
    List<SensorReadingRow> findByPondIdOrderByMeasuredAtDesc(UUID pondId);

    List<SensorReadingRow> findByPondIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
        UUID pondId, java.time.OffsetDateTime start, java.time.OffsetDateTime end);

    List<SensorReadingRow> findByProjectIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
        UUID projectId, java.time.OffsetDateTime start, java.time.OffsetDateTime end);

    /** Batched min/max per pond (pond-comparison options window). */
    @org.springframework.data.jpa.repository.Query(
        "select r.pondId, min(r.measuredAt), max(r.measuredAt) from SensorReadingRow r"
        + " where r.pondId in :pondIds group by r.pondId")
    List<Object[]> findReadingWindows(java.util.Collection<UUID> pondIds);

    long countBySensorMessageId(UUID sensorMessageId);
  }
}
