package com.aquashield.common.security;

import com.fasterxml.jackson.databind.JsonNode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.TreeMap;

/**
 * Application-level payload HMAC — EXACT port of the monolith mqtt_adapter scheme so
 * device signatures verify byte-for-byte across the AWS IoT bridge and Ingestion:
 *
 *   canonical = json.dumps(payload_without_sig, separators=(",",":"), sort_keys=True)
 *   sig       = HMAC_SHA256(device_key_utf8, canonical_utf8) lowercase hex
 *   compare   = constant-time
 *
 * Canonicalization: object keys sorted recursively, arrays in order, compact separators,
 * UTF-8. The "sig" field is excluded from the signed body; everything else is included.
 */
public final class PayloadHmac {

  public static final String SIG_FIELD = "sig";

  private PayloadHmac() {}

  /** Canonical JSON of the payload with the sig field removed (Python-json.dumps parity). */
  public static String canonicalize(JsonNode payload) {
    StringBuilder sb = new StringBuilder();
    JsonNode unsigned = payload.deepCopy();
    if (unsigned.isObject()) {
      ((com.fasterxml.jackson.databind.node.ObjectNode) unsigned).remove(SIG_FIELD);
    }
    write(unsigned, sb);
    return sb.toString();
  }

  public static String sign(JsonNode payload, String deviceKey) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(deviceKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] digest = mac.doFinal(canonicalize(payload).getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (Exception e) {
      throw new IllegalStateException("HMAC unavailable", e);
    }
  }

  /** Constant-time verification against the payload's own sig field. */
  public static boolean verify(JsonNode payload, String deviceKey) {
    JsonNode sig = payload.get(SIG_FIELD);
    if (sig == null || !sig.isTextual() || sig.asText().isBlank()
        || deviceKey == null || deviceKey.isBlank()) {
      return false;
    }
    return MessageDigest.isEqual(
        sign(payload, deviceKey).getBytes(StandardCharsets.UTF_8),
        sig.asText().getBytes(StandardCharsets.UTF_8));
  }

  private static void write(JsonNode node, StringBuilder sb) {
    if (node.isObject()) {
      TreeMap<String, JsonNode> sorted = new TreeMap<>();
      node.properties().forEach(e -> sorted.put(e.getKey(), e.getValue()));
      sb.append('{');
      boolean first = true;
      for (var e : sorted.entrySet()) {
        if (!first) {
          sb.append(',');
        }
        first = false;
        sb.append('"').append(escape(e.getKey())).append("\":");
        write(e.getValue(), sb);
      }
      sb.append('}');
    } else if (node.isArray()) {
      sb.append('[');
      boolean first = true;
      for (JsonNode item : node) {
        if (!first) {
          sb.append(',');
        }
        first = false;
        write(item, sb);
      }
      sb.append(']');
    } else if (node.isTextual()) {
      sb.append('"').append(escape(node.asText())).append('"');
    } else {
      // numbers / booleans / null: Jackson's textual form matches python json for
      // ints and standard doubles (7.2 -> 7.2, 42 -> 42, null -> null)
      sb.append(node.isNull() ? "null" : node.asText());
    }
  }

  private static String escape(String value) {
    StringBuilder sb = new StringBuilder(value.length());
    for (char c : value.toCharArray()) {
      switch (c) {
        case '"' -> sb.append("\\\"");
        case '\\' -> sb.append("\\\\");
        case '\n' -> sb.append("\\n");
        case '\r' -> sb.append("\\r");
        case '\t' -> sb.append("\\t");
        default -> {
          if (c < 0x20) {
            sb.append(String.format("\\u%04x", (int) c));
          } else {
            sb.append(c);
          }
        }
      }
    }
    return sb.toString();
  }
}
