package com.aquashield.pond.service;

import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class HistoricalService {

  private static final Logger log = LoggerFactory.getLogger(HistoricalService.class);

  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub;

  public HistoricalService(IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub) {
    this.ingestionStub = ingestionStub;
  }

  /**
   * Returns a simple time-series for the pond, filtered to the requested parameters.
   * Shape: { "data": [ { "measuredAt": "...", "parameter": value, ... }, ... ], "truncated": bool }
   * Legacy endpoint — the charts API (analytics-service) is the preferred read path.
   */
  public Map<String, Object> getHistorical(UUID pondId, LocalDate startDate, LocalDate endDate,
                                           List<String> parameters) {
    String start = startDate.atStartOfDay(ZoneOffset.UTC).toInstant().toString();
    String end = endDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toString();

    try {
      var response = ingestionStub.getReadings(
          GetReadingsRequest.newBuilder()
              .setPondId(pondId.toString())
              .setStart(start)
              .setEnd(end)
              .build()
      );

      List<Map<String, Object>> data = new ArrayList<>();
      for (ReadingRow row : response.getRowsList()) {
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("measuredAt", row.getMeasuredAt());
        row.getValuesMap().forEach((code, value) -> {
          if (parameters == null || parameters.isEmpty() || parameters.contains(code)) {
            point.put(code, value);
          }
        });
        if (point.size() > 1) { // has at least one value besides measuredAt
          data.add(point);
        }
      }

      return Map.of("data", data, "truncated", response.getTruncated());
    } catch (StatusRuntimeException e) {
      log.warn("ingestion gRPC unavailable for historical (pond={}): {}", pondId, e.getStatus());
      return Map.of("data", List.of(), "truncated", false);
    }
  }
}
