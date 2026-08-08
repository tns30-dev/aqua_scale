package com.aquashield.ingestion.service;

import com.aquashield.ingestion.domain.Entities.SensorMessage;
import com.aquashield.ingestion.domain.Entities.SensorReadingRow;
import com.aquashield.ingestion.repo.Repos.SensorMessageRepository;
import com.aquashield.ingestion.repo.Repos.SensorReadingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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
  private final JdbcTemplate jdbc;
  private final TelemetryWriter telemetryWriter;

  public ReadingStore(SensorMessageRepository messages, SensorReadingRepository readings,
                      JdbcTemplate jdbc, TelemetryWriter telemetryWriter) {
    this.messages = messages;
    this.readings = readings;
    this.jdbc = jdbc;
    this.telemetryWriter = telemetryWriter;
  }

  /** Returns rows inserted, or -1 on duplicate (PARITY: UNIQUE(device, seq) get_or_create). */
  @Transactional
  public int persist(UUID deviceId, String deviceCode, long seqNo, JsonNode payload,
                     OffsetDateTime measuredAt, List<Row> rows) {
    if (messages.existsByIotDeviceIdAndSeqNo(deviceId, seqNo)) {
      return -1;
    }
    SensorMessage message = messages.save(new SensorMessage(deviceId, deviceCode, seqNo, payload));
    List<TelemetryWriter.StoredReading> storedRows = new ArrayList<>();
    for (Row row : rows) {
      SensorReadingRow saved = readings.save(new SensorReadingRow(message.getSensorMessageId(), row.projectId(),
          row.pondId(), row.projectSensorId(), row.port(), measuredAt, row.values()));
      storedRows.add(new TelemetryWriter.StoredReading(saved.getReadingId(), row.projectId(),
          row.pondId(), row.projectSensorId(), row.port(), measuredAt, row.values()));
      upsertEnergyHour(row, measuredAt);
    }
    telemetryWriter.persist(message.getSensorMessageId(), deviceId, deviceCode, seqNo, payload,
        measuredAt, storedRows);
    return rows.size();
  }

  private void upsertEnergyHour(Row row, OffsetDateTime measuredAt) {
    JsonNode electricity = row.values().get("electricity");
    if (electricity == null || !electricity.isNumber()) {
      return;
    }
    OffsetDateTime hour = measuredAt.toInstant().truncatedTo(ChronoUnit.HOURS)
        .atOffset(ZoneOffset.UTC);
    jdbc.update("""
        insert into ingestion.energy_hourly_readings
          (project_id, hour_start, kwh, sample_count, updated_at)
        values (?, ?, ?, 1, now())
        on conflict (project_id, hour_start) do update set
          kwh = ingestion.energy_hourly_readings.kwh + excluded.kwh,
          sample_count = ingestion.energy_hourly_readings.sample_count + 1,
          updated_at = now()
        """, row.projectId(), hour, electricity.asDouble());
  }
}
