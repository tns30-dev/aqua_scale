package com.aquashield.ingestion.service;

import com.aquashield.ingestion.domain.Entities.SensorMessage;
import com.aquashield.ingestion.domain.Entities.SensorReadingRow;
import com.aquashield.ingestion.repo.Repos.SensorMessageRepository;
import com.aquashield.ingestion.repo.Repos.SensorReadingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Atomic message+readings persistence (separate component so @Transactional proxies
 * apply — self-invocation inside the pipeline would silently skip the transaction).
 *
 * This is the cost-safe DEMO store; the cloud raw-telemetry target is Bigtable
 * (main/polyglot_persistence.md) behind this same interface shape.
 */
@Service
public class ReadingStore {

  public record Row(UUID projectId, UUID pondId, UUID projectSensorId, String port,
                    JsonNode values) {}

  private final SensorMessageRepository messages;
  private final SensorReadingRepository readings;

  public ReadingStore(SensorMessageRepository messages, SensorReadingRepository readings) {
    this.messages = messages;
    this.readings = readings;
  }

  /** Returns rows inserted, or -1 on duplicate (PARITY: UNIQUE(device, seq) get_or_create). */
  @Transactional
  public int persist(UUID deviceId, String deviceCode, long seqNo, JsonNode payload,
                     OffsetDateTime measuredAt, List<Row> rows) {
    if (messages.existsByIotDeviceIdAndSeqNo(deviceId, seqNo)) {
      return -1;
    }
    SensorMessage message = messages.save(new SensorMessage(deviceId, deviceCode, seqNo, payload));
    for (Row row : rows) {
      readings.save(new SensorReadingRow(message.getSensorMessageId(), row.projectId(),
          row.pondId(), row.projectSensorId(), row.port(), measuredAt, row.values()));
    }
    return rows.size();
  }
}
