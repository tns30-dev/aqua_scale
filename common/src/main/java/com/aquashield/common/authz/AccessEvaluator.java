package com.aquashield.common.authz;

import java.util.List;

import static com.aquashield.common.authz.FeatureActionEntry.WILDCARD;

/**
 * THE canonical feature/action allow logic — single implementation shared by Identity
 * (source side) and every snapshot consumer, so authorization semantics can never drift
 * between services.
 *
 * PARITY rules (ported from monolith RBACService; verified by parity oracles):
 *  - Purely additive: no deny mechanism; absence = denied.
 *  - Feature wildcard entry ("*") grants every feature AND every action.
 *  - GLOBAL ACTION-WILDCARD: "*" inside ANY entry's action_controls grants ANY action
 *    globally (not scoped to that entry's feature) — intentional monolith behavior.
 *  - Malformed entries (null fields/lists) are silently skipped.
 */
public final class AccessEvaluator {

  private AccessEvaluator() {}

  public static boolean hasFeatureAccess(List<FeatureActionEntry> entries, String featureCode) {
    if (entries == null) {
      return false;
    }
    for (FeatureActionEntry e : entries) {
      if (e == null || e.featureAccess() == null) {
        continue;
      }
      if (WILDCARD.equals(e.featureAccess()) || e.featureAccess().equals(featureCode)) {
        return true;
      }
    }
    return false;
  }

  public static boolean hasActionControl(List<FeatureActionEntry> entries, String actionCode) {
    if (entries == null) {
      return false;
    }
    for (FeatureActionEntry e : entries) {
      if (e == null || e.featureAccess() == null) {
        continue;
      }
      if (WILDCARD.equals(e.featureAccess())) {
        return true; // feature wildcard grants every action
      }
      List<String> actions = e.actionControls();
      if (actions == null) {
        continue;
      }
      if (actions.contains(WILDCARD) || actions.contains(actionCode)) {
        return true;
      }
    }
    return false;
  }
}
