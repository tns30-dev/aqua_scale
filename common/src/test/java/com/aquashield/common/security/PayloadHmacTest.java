package com.aquashield.common.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CROSS-LANGUAGE PARITY: the expected canonical string and signature below were
 * generated with the monolith's exact Python scheme:
 *   json.dumps(unsigned, separators=(",",":"), sort_keys=True)
 *   hmac.new(key, canonical, hashlib.sha256).hexdigest()
 * If these assertions pass, Python-signed device payloads verify in Java byte-for-byte.
 */
class PayloadHmacTest {

  private static final ObjectMapper M = new ObjectMapper();
  private static final String KEY = "super-secret-device-key";
  private static final String PYTHON_CANONICAL =
      "{\"device_code\":\"DEV-001\",\"sensor_batches\":[{\"port\":\"A1\",\"readings\":"
          + "[{\"parameter\":\"ph\",\"value\":7.2}]}],\"seq_no\":42,\"ts\":1780560000}";
  private static final String PYTHON_SIG =
      "fd594ad0b8cd9ee70820242ca879f33bc5d419c2e237c1b0bee931917898e660";

  private static ObjectNode payload() throws Exception {
    return (ObjectNode) M.readTree("""
        {"device_code":"DEV-001","ts":1780560000,"seq_no":42,
         "sensor_batches":[{"port":"A1","readings":[{"parameter":"ph","value":7.2}]}],
         "sig":"%s"}""".formatted(PYTHON_SIG));
  }

  @Test
  void canonicalization_matchesPythonJsonDumps() throws Exception {
    assertThat(PayloadHmac.canonicalize(payload())).isEqualTo(PYTHON_CANONICAL);
  }

  @Test
  void signature_matchesPythonHmac() throws Exception {
    assertThat(PayloadHmac.sign(payload(), KEY)).isEqualTo(PYTHON_SIG);
    assertThat(PayloadHmac.verify(payload(), KEY)).isTrue();
  }

  // Oracle #13 — tampering any signed field breaks verification
  @Test
  void tamperedField_failsVerification() throws Exception {
    ObjectNode tampered = payload();
    tampered.put("seq_no", 43);
    assertThat(PayloadHmac.verify(tampered, KEY)).isFalse();
  }

  // Oracle #15/#16 — missing key / missing sig → false (fail closed)
  @Test
  void missingKeyOrSig_failsClosed() throws Exception {
    assertThat(PayloadHmac.verify(payload(), "")).isFalse();
    assertThat(PayloadHmac.verify(payload(), null)).isFalse();
    ObjectNode noSig = payload();
    noSig.remove("sig");
    assertThat(PayloadHmac.verify(noSig, KEY)).isFalse();
  }

  @Test
  void wrongKey_failsVerification() throws Exception {
    assertThat(PayloadHmac.verify(payload(), "wrong-key")).isFalse();
  }

  // JsonNode order must not matter (sort_keys parity)
  @Test
  void keyOrderIndependence() throws Exception {
    JsonNode reordered = M.readTree("""
        {"ts":1780560000,"seq_no":42,"device_code":"DEV-001",
         "sensor_batches":[{"port":"A1","readings":[{"parameter":"ph","value":7.2}]}]}""");
    assertThat(PayloadHmac.canonicalize(reordered)).isEqualTo(PYTHON_CANONICAL);
  }
}
