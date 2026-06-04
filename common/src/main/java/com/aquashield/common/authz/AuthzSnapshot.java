package com.aquashield.common.authz;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * THE canonical Redis authorization snapshot contract (main/redis.md "Authorization
 * Snapshot Shape"). Identity writes it at `authz:snapshot:{userId}:{version}`; every
 * other service reads it for hot-path authorization instead of calling Identity.
 *
 * pondIdsByProject / deviceIdsByProject / deniedFeatures are NEW capabilities with no
 * monolith equivalent — empty until pond/device-level ACLs are introduced.
 */
public record AuthzSnapshot(
    UUID userId,
    long version,
    String roleType,
    List<FeatureActionEntry> features,
    List<UUID> projectIds,
    Map<String, List<UUID>> pondIdsByProject,
    Map<String, List<UUID>> deviceIdsByProject,
    List<String> deniedFeatures,
    Instant issuedAt,
    Instant expiresAt) {

  public boolean hasFeatureAccess(String featureCode) {
    return AccessEvaluator.hasFeatureAccess(features, featureCode);
  }

  public boolean hasActionControl(String actionCode) {
    return AccessEvaluator.hasActionControl(features, actionCode);
  }

  public boolean hasProjectAccess(UUID projectId) {
    return projectIds != null && projectIds.contains(projectId);
  }
}
