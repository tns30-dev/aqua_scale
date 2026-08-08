package com.aquashield.ingestion.service;

import com.aquashield.api.sensor.v1.DevicePortMapping;
import com.aquashield.api.sensor.v1.DeviceValidationMetadata;
import com.aquashield.api.sensor.v1.GetDeviceValidationMetadataRequest;
import com.aquashield.api.sensor.v1.ResolveDevicePortRequest;
import com.aquashield.api.sensor.v1.SensorServiceGrpc;
import com.aquashield.common.security.PayloadHmac;
import com.aquashield.ingestion.config.IngestionProperties;
import com.aquashield.ingestion.events.IngestionEventPublisher;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The parity-ordered ingestion pipeline (module_data_ingestion/services.py §2.6):
 * validate payload -> device gate + HMAC -> resolve ports -> strict pivot -> idempotent
 * persist -> events. Hard validation failures persist NOTHING (monolith tx-rollback
 * semantics: validation happens before any write here — behavior-identical).
 *
 * Outcomes: OK | DUPLICATE (ack, silent) | REJECTED (permanent: ack + rejected event)
 * | TRANSIENT (nack -> Pub/Sub retry -> DLQ after max attempts).
 */
@Service
public class IngestionPipeline {

  public enum Outcome { OK, DUPLICATE, REJECTED, TRANSIENT }

  public record Result(Outcome outcome, String reason, int rowsInserted) {}

  private static final Logger log = LoggerFactory.getLogger(IngestionPipeline.class);

  private final SensorServiceGrpc.SensorServiceBlockingStub sensor;
  private final ParameterCatalogueClient catalogue;
  private final ReadingStore store;
  private final IngestionEventPublisher events;
  private final IngestionProperties props;
  private final ObjectMapper mapper;

  public IngestionPipeline(SensorServiceGrpc.SensorServiceBlockingStub sensor,
                           ParameterCatalogueClient catalogue, ReadingStore store,
                           IngestionEventPublisher events, IngestionProperties props,
                           ObjectMapper mapper) {
    this.sensor = sensor;
    this.catalogue = catalogue;
    this.store = store;
    this.events = events;
    this.props = props;
    this.mapper = mapper;
  }

  public Result process(JsonNode envelope) {
    String correlationId = envelope.path("correlationId").asText(null);
    JsonNode payload = envelope.get("payload");
    String deviceCode = payload == null ? "?" : payload.path("device_code").asText("?");
    try {
      return doProcess(envelope, payload, correlationId);
    } catch (RejectedException e) {
      events.publish(IngestionEventPublisher.TOPIC_REJECTED, correlationId, null, null,
          mapper.createObjectNode().put("deviceCode", deviceCode).put("reason", e.getMessage()));
      log.info("Rejected telemetry device={}: {}", deviceCode, e.getMessage());
      return new Result(Outcome.REJECTED, e.getMessage(), 0);
    } catch (StatusRuntimeException e) {
      if (isTransientGrpc(e)) {
        log.warn("Transient gRPC failure device={}: {}", deviceCode, e.getStatus());
        return new Result(Outcome.TRANSIENT, e.getStatus().toString(), 0);
      }
      // PARITY: NOT_FOUND from ResolveDevice carries the exact unknown/inactive message
      String reason = e.getStatus().getDescription() != null
          ? e.getStatus().getDescription() : e.getStatus().toString();
      events.publish(IngestionEventPublisher.TOPIC_REJECTED, correlationId, null, null,
          mapper.createObjectNode().put("deviceCode", deviceCode).put("reason", reason));
      return new Result(Outcome.REJECTED, reason, 0);
    } catch (Exception e) {
      // DB down, serialization trouble, etc. -> retry path
      log.error("Transient ingestion failure device={}", deviceCode, e);
      return new Result(Outcome.TRANSIENT, e.toString(), 0);
    }
  }

  private Result doProcess(JsonNode envelope, JsonNode payload, String correlationId) {
    // 1. envelope + payload required fields (parity: serializer requireds)
    if (payload == null || !payload.isObject()) {
      throw new RejectedException("Missing payload");
    }
    String deviceCode = requireText(payload, "device_code");
    long seqNo = requireLong(payload, "seq_no");
    String measuredAtRaw = requireText(payload, "measured_at");
    JsonNode batches = payload.get("sensor_batches");
    if (batches == null || !batches.isArray() || batches.isEmpty()) {
      throw new RejectedException("sensor_batches is required");
    }
    OffsetDateTime measuredAt = parseMeasuredAt(measuredAtRaw);

    // 2. device gate + HMAC metadata (single RPC serves both)
    DeviceValidationMetadata meta = sensor.getDeviceValidationMetadata(
        GetDeviceValidationMetadataRequest.newBuilder().setDeviceCode(deviceCode).build());
    if (!meta.getKnown() || !meta.getActive()) {
      // PARITY: unknown and inactive are indistinguishable
      throw new RejectedException("Unknown or Inactive IoT device - '" + deviceCode + "'.");
    }
    if (props.hmacEnabled()) {
      verifyHmac(payload, meta, deviceCode);
    }

    // 3. resolve all ports + strict pivot BEFORE persisting anything
    //    (parity net-effect: hard error -> nothing persisted)
    Map<String, String> idToCode = catalogue.idToCode();
    List<PendingRow> pending = new ArrayList<>();
    for (JsonNode batch : batches) {
      String port = batch.path("port").asText("");
      if (port.isBlank()) {
        throw new RejectedException("Batch missing port");
      }
      DevicePortMapping mapping = sensor.resolveDevicePort(ResolveDevicePortRequest.newBuilder()
          .setDeviceCode(deviceCode).setPort(port).build());
      if (!mapping.getFound()) {
        // PARITY: unknown port is a HARD error (not a skip)
        throw new RejectedException(
            "No Sensor mapping for device '" + deviceCode + "' port '" + port + "'.");
      }
      Set<String> allowed = new HashSet<>();
      for (String parameterTypeId : mapping.getParameterTypeIdsList()) {
        String code = idToCode.get(parameterTypeId);
        if (code != null) {
          allowed.add(code);
        }
      }
      Map<String, JsonNode> values = pivot(batch.path("readings"), allowed, deviceCode, port);
      if (values.isEmpty()) {
        continue; // PARITY: empty allowed set / nothing usable -> silent skip of this port
      }
      pending.add(new PendingRow(mapping, port, values));
    }

    // 4. idempotent persist (parity dedup: UNIQUE (device, seq))
    UUID deviceId = UUID.fromString(meta.getDeviceId());
    List<ReadingStore.Row> storeRows = new ArrayList<>();
    for (PendingRow row : pending) {
      ObjectNode values = mapper.createObjectNode();
      row.values().forEach(values::set);
      storeRows.add(new ReadingStore.Row(
          UUID.fromString(row.mapping().getProjectId()),
          row.mapping().getPondId().isBlank() ? null : UUID.fromString(row.mapping().getPondId()),
          UUID.fromString(row.mapping().getProjectSensorId()),
          row.port(), values));
    }
    int rows = store.persist(deviceId, deviceCode, seqNo, payload, measuredAt, storeRows);
    if (rows < 0) {
      return new Result(Outcome.DUPLICATE, "duplicate seq_no", 0);
    }

    // 5. events (best-effort, post-persist — parity with post-commit broadcast)
    events.publish(IngestionEventPublisher.TOPIC_VALIDATED, correlationId, null, null,
        mapper.createObjectNode().put("deviceCode", deviceCode).put("seqNo", seqNo)
            .put("rows", rows));
    for (PendingRow row : pending) {
      ObjectNode values = mapper.createObjectNode();
      row.values().forEach(values::set);
      events.publish(IngestionEventPublisher.TOPIC_READING_INGESTED, correlationId,
          row.mapping().getProjectId(),
          row.mapping().getPondId().isBlank() ? null : row.mapping().getPondId(),
          mapper.createObjectNode()
              .put("projectSensorId", row.mapping().getProjectSensorId())
              .put("port", row.port())
              .put("measuredAt", measuredAt.toString())
              .<ObjectNode>set("values", values));
    }
    return new Result(Outcome.OK, null, rows);
  }

  /**
   * PARITY (pivot_readings, strict_mode=True as MQTT used): unknown param -> hard error;
   * duplicate param in same port -> ALWAYS hard error; reading without 'parameter' key
   * -> skipped; empty result allowed (caller skips the port silently).
   */
  private Map<String, JsonNode> pivot(JsonNode readingsNode, Set<String> allowed,
                                      String deviceCode, String port) {
    Map<String, JsonNode> values = new LinkedHashMap<>();
    if (readingsNode == null || !readingsNode.isArray()) {
      return values;
    }
    for (JsonNode reading : readingsNode) {
      JsonNode param = reading.get("parameter");
      if (param == null || !param.isTextual() || param.asText().isBlank()) {
        continue; // parity: missing parameter key -> skip
      }
      String code = param.asText();
      if (values.containsKey(code)) {
        throw new RejectedException(
            "Duplicate parameter '" + code + "' in same port '" + port + "'.");
      }
      if (!allowed.contains(code)) {
        if (allowed.isEmpty()) {
          return Map.of(); // empty allow-list: silent skip of the whole port
        }
        throw new RejectedException("Parameter '" + code + "' not allowed for device '"
            + deviceCode + "' port '" + port + "'.");
      }
      values.put(code, reading.path("value"));
    }
    return values;
  }

  private void verifyHmac(JsonNode payload, DeviceValidationMetadata meta, String deviceCode) {
    // PARITY pre-checks: required fields, int ts, skew, key present — then constant-time HMAC
    if (!payload.hasNonNull("ts") || !payload.hasNonNull(PayloadHmac.SIG_FIELD)) {
      throw new RejectedException("HMAC fields missing (ts/sig)");
    }
    if (!payload.get("ts").canConvertToLong()) {
      throw new RejectedException("Invalid ts");
    }
    long skew = Math.abs(Instant.now().getEpochSecond() - payload.get("ts").asLong());
    if (skew > props.maxSkew().toSeconds()) {
      throw new RejectedException("Timestamp skew exceeded");
    }
    if (meta.getDeviceKey().isBlank()) {
      throw new RejectedException("Device has no key configured");
    }
    if (!PayloadHmac.verify(payload, meta.getDeviceKey())) {
      throw new RejectedException("Invalid HMAC signature for device '" + deviceCode + "'.");
    }
  }

  private static boolean isTransientGrpc(StatusRuntimeException e) {
    Status.Code code = e.getStatus().getCode();
    return code == Status.Code.UNAVAILABLE || code == Status.Code.DEADLINE_EXCEEDED
        || code == Status.Code.INTERNAL || code == Status.Code.UNKNOWN;
  }

  private static String requireText(JsonNode payload, String field) {
    JsonNode v = payload.get(field);
    if (v == null || !v.isTextual() || v.asText().isBlank()) {
      throw new RejectedException(field + " is required");
    }
    return v.asText();
  }

  private static long requireLong(JsonNode payload, String field) {
    JsonNode v = payload.get(field);
    if (v == null || !v.canConvertToLong()) {
      throw new RejectedException(field + " is required");
    }
    return v.asLong();
  }

  private static OffsetDateTime parseMeasuredAt(String raw) {
    try {
      return OffsetDateTime.parse(raw);
    } catch (Exception e) {
      try {
        return Instant.parse(raw).atOffset(ZoneOffset.UTC);
      } catch (Exception e2) {
        throw new RejectedException("Invalid measured_at format");
      }
    }
  }

  private record PendingRow(DevicePortMapping mapping, String port, Map<String, JsonNode> values) {}

  static class RejectedException extends RuntimeException {
    RejectedException(String message) {
      super(message);
    }
  }
}
