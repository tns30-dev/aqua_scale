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

    long countBySensorMessageId(UUID sensorMessageId);
  }
}
