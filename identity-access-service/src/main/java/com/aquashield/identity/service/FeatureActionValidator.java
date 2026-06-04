package com.aquashield.identity.service;

import com.aquashield.identity.domain.FeatureActionEntry;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.aquashield.identity.domain.FeatureActionEntry.WILDCARD;

/**
 * Structural validation of feature_action_assigned (port of module_user/validators.py).
 * PARITY: structure only — cross-table existence of codes is deliberately NOT checked.
 */
@Component
public class FeatureActionValidator {

  public void validate(List<FeatureActionEntry> entries) {
    if (entries == null) {
      return;
    }
    Set<String> seenFeatures = new HashSet<>();
    for (FeatureActionEntry e : entries) {
      if (e == null || e.featureAccess() == null || e.featureAccess().isBlank()) {
        throw new InvalidFeatureActionException("Each entry requires a feature_access code.");
      }
      List<String> actions = e.actionControls();
      if (actions == null) {
        throw new InvalidFeatureActionException("action_controls must be a list of strings.");
      }
      if (actions.stream().anyMatch(a -> a == null || a.isBlank())) {
        throw new InvalidFeatureActionException("action_controls must be non-empty strings.");
      }
      if (WILDCARD.equals(e.featureAccess())
          && !(actions.isEmpty() || actions.equals(List.of(WILDCARD)))) {
        throw new InvalidFeatureActionException(
            "Wildcard feature '*' may only have action_controls [] or [\"*\"].");
      }
      if (actions.contains(WILDCARD) && actions.size() > 1) {
        throw new InvalidFeatureActionException(
            "'*' cannot be mixed with specific action codes.");
      }
      if (!seenFeatures.add(e.featureAccess())) {
        throw new InvalidFeatureActionException(
            "Duplicate feature_access code '" + e.featureAccess() + "'.");
      }
    }
  }

  public static class InvalidFeatureActionException extends RuntimeException {
    public InvalidFeatureActionException(String message) {
      super(message);
    }
  }
}
