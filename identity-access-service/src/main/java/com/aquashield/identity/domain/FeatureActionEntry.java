package com.aquashield.identity.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * One entry of the {@code feature_action_assigned} JSONB array.
 *
 * PARITY: inner keys are snake_case ON THE WIRE ("feature_access", "action_controls") —
 * the monolith stores and the frontend parses snake_case. Do not camelCase these.
 * Wildcard sentinel: {"feature_access": "*", "action_controls": ["*"]} grants everything.
 */
public record FeatureActionEntry(
    @JsonProperty("feature_access") String featureAccess,
    @JsonProperty("action_controls") List<String> actionControls) {

  public static final String WILDCARD = "*";

  public static FeatureActionEntry wildcard() {
    return new FeatureActionEntry(WILDCARD, List.of(WILDCARD));
  }
}
