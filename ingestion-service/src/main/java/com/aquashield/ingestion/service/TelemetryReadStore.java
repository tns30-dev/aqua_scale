package com.aquashield.ingestion.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TelemetryReadStore {

  record Reading(UUID projectId, UUID pondId, UUID projectSensorId, String port,
                 OffsetDateTime measuredAt, JsonNode values) {}

  record EnergyHour(Instant hourStart, double kwh) {}

  record BucketAverage(UUID pondId, String parameter, Instant bucketStart,
                       double average, long sampleCount) {}

  record Window(UUID pondId, Instant firstAt, Instant lastAt) {}

  List<Reading> findReadings(UUID pondId, UUID projectId, OffsetDateTime start,
                             OffsetDateTime end, int limit);

  List<EnergyHour> findProjectElectricityHourly(UUID projectId, OffsetDateTime start,
                                                OffsetDateTime end, ZoneId zone);

  List<BucketAverage> findPondParameterBucketAverages(UUID pondId, OffsetDateTime start,
                                                      OffsetDateTime end, ZoneId zone,
                                                      String grouping,
                                                      Collection<String> parameters);

  List<Reading> findLatestByProject(UUID projectId, Collection<UUID> pondIds);

  List<Window> findReadingWindows(Collection<UUID> pondIds);
}
