package com.aquashield.identity.service;

import com.aquashield.identity.domain.ActionControl;
import com.aquashield.identity.domain.FeatureAccess;
import com.aquashield.identity.domain.FeatureActionEntry;
import com.aquashield.identity.domain.User;
import com.aquashield.identity.repo.ActionControlRepository;
import com.aquashield.identity.repo.FeatureAccessRepository;
import com.aquashield.identity.repo.UserProjectRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.aquashield.identity.domain.FeatureActionEntry.WILDCARD;

/**
 * Exact port of monolith RBACService (module_user/services.py). The unit-test oracle
 * cases from the monolith's test_services.py define this class's required behavior.
 *
 * PARITY rules preserved deliberately:
 *  - Purely additive permissions: no deny mechanism; absence = denied.
 *  - Feature wildcard entry ("*") grants every feature AND every action.
 *  - GLOBAL ACTION-WILDCARD LEAK: "*" inside ANY entry's action_controls grants ANY
 *    action globally (not scoped to that entry's feature). The monolith asserts this.
 *  - Malformed entries (null fields, null lists) are silently skipped.
 *  - Project access = existence of a user_projects row; revocation is immediate.
 */
@Service
public class RbacService {

  private final UserProjectRepository userProjects;
  private final FeatureAccessRepository featureAccess;
  private final ActionControlRepository actionControls;

  public RbacService(UserProjectRepository userProjects,
                     FeatureAccessRepository featureAccess,
                     ActionControlRepository actionControls) {
    this.userProjects = userProjects;
    this.featureAccess = featureAccess;
    this.actionControls = actionControls;
  }

  public List<UUID> getUserProjectIds(UUID userId) {
    return userProjects.findProjectIdsByUserId(userId);
  }

  public boolean hasProjectAccess(UUID userId, UUID projectId) {
    return userProjects.existsByUserIdAndProjectId(userId, projectId);
  }

  public boolean hasFeatureAccess(User user, String featureCode) {
    for (FeatureActionEntry e : safeEntries(user)) {
      if (WILDCARD.equals(e.featureAccess()) || e.featureAccess().equals(featureCode)) {
        return true;
      }
    }
    return false;
  }

  public boolean hasActionControl(User user, String actionCode) {
    for (FeatureActionEntry e : safeEntries(user)) {
      if (WILDCARD.equals(e.featureAccess())) {
        return true; // feature wildcard grants every action
      }
      List<String> actions = e.actionControls();
      if (actions == null) {
        continue; // malformed tolerance
      }
      // PARITY: "*" in ANY entry grants ANY action (global leak — intentional)
      if (actions.contains(WILDCARD) || actions.contains(actionCode)) {
        return true;
      }
    }
    return false;
  }

  public boolean isPlatformAdmin(User user) {
    return user != null && user.isPlatformAdmin();
  }

  /**
   * PARITY (get_default_access): default features joined with their default actions;
   * actions sorted; features without default actions get an empty list.
   */
  public List<FeatureActionEntry> getDefaultAccess() {
    Map<UUID, List<String>> defaultActionsByFeature = actionControls.findByDefaultGrantTrue().stream()
        .collect(Collectors.groupingBy(ActionControl::getFeatureAccessId,
            Collectors.mapping(ActionControl::getCode, Collectors.toList())));

    return featureAccess.findByDefaultGrantTrue().stream()
        .sorted(Comparator.comparing(FeatureAccess::getCode))
        .map(f -> {
          List<String> actions = new ArrayList<>(
              defaultActionsByFeature.getOrDefault(f.getFeatureAccessId(), List.of()));
          actions.sort(Comparator.naturalOrder());
          return new FeatureActionEntry(f.getCode(), actions);
        })
        .toList();
  }

  /** PARITY (_iter_entries): tolerate malformed data — skip null/invalid entries. */
  private List<FeatureActionEntry> safeEntries(User user) {
    if (user == null || user.getFeatureActionAssigned() == null) {
      return List.of();
    }
    return user.getFeatureActionAssigned().stream()
        .filter(e -> e != null && e.featureAccess() != null)
        .toList();
  }
}
