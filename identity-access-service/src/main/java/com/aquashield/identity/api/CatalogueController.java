package com.aquashield.identity.api;

import com.aquashield.identity.domain.ActionControl;
import com.aquashield.identity.domain.FeatureAccess;
import com.aquashield.identity.repo.ActionControlRepository;
import com.aquashield.identity.repo.FeatureAccessRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * RBAC catalogues for the user-management screen (PARITY: module_user
 * FeatureAccessListView / ActionControlListView — platform-admin only, BARE arrays
 * (no envelope), camelCase rows, ordered by name ascending).
 *
 * PARITY QUIRK: the frontend calls /api/action-controls/ WITH a trailing slash while
 * the monolith registered the route without one — both forms are mapped here.
 */
@RestController
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class CatalogueController {

  public record FeatureAccessDto(UUID featureAccessId, String name, String code,
                                 boolean isDefault) {

    static FeatureAccessDto from(FeatureAccess f) {
      return new FeatureAccessDto(f.getFeatureAccessId(), f.getName(), f.getCode(),
          f.isDefaultGrant());
    }
  }

  public record ActionControlDto(UUID actionControlId, UUID featureAccessId, String name,
                                 String code, boolean isDefault) {

    static ActionControlDto from(ActionControl a) {
      return new ActionControlDto(a.getActionControlId(), a.getFeatureAccessId(),
          a.getName(), a.getCode(), a.isDefaultGrant());
    }
  }

  private final FeatureAccessRepository features;
  private final ActionControlRepository actions;

  public CatalogueController(FeatureAccessRepository features, ActionControlRepository actions) {
    this.features = features;
    this.actions = actions;
  }

  @GetMapping({"/api/feature-access", "/api/feature-access/"})
  public List<FeatureAccessDto> featureAccess() {
    return features.findAllByOrderByNameAsc().stream().map(FeatureAccessDto::from).toList();
  }

  @GetMapping({"/api/action-controls", "/api/action-controls/"})
  public List<ActionControlDto> actionControls() {
    return actions.findAllByOrderByNameAsc().stream().map(ActionControlDto::from).toList();
  }
}
