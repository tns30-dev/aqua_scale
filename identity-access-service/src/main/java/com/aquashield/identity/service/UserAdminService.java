package com.aquashield.identity.service;

import com.aquashield.identity.api.dto.UserAdminDtos.AccessReadResponse;
import com.aquashield.identity.api.dto.UserAdminDtos.AccessUpdateRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.AdminUpdateRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.OnboardRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.OnboardResponse;
import com.aquashield.identity.api.dto.UserAdminDtos.UserListItem;
import com.aquashield.identity.domain.User;
import com.aquashield.identity.domain.UserProject;
import com.aquashield.identity.repo.UserProjectRepository;
import com.aquashield.identity.repo.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Admin user management (parity: module_user views/serializers; platform_admin only —
 * enforced at the controller). DIVERGENCE (transitional): projectIds existence cannot be
 * validated here anymore (Project Service owns projects) — TODO: gRPC ValidateProject
 * when Project Service exists.
 */
@Service
public class UserAdminService {

  private final UserRepository users;
  private final UserProjectRepository userProjects;
  private final PasswordEncoder passwordEncoder;
  private final FeatureActionValidator featureValidator;
  private final RbacService rbac;
  private final AuthzSnapshotService snapshots;

  public UserAdminService(UserRepository users, UserProjectRepository userProjects,
                          PasswordEncoder passwordEncoder, FeatureActionValidator featureValidator,
                          RbacService rbac, AuthzSnapshotService snapshots) {
    this.users = users;
    this.userProjects = userProjects;
    this.passwordEncoder = passwordEncoder;
    this.featureValidator = featureValidator;
    this.rbac = rbac;
    this.snapshots = snapshots;
  }

  /** PARITY: hides platform_admin rows; ordered -created_at. */
  @Transactional(readOnly = true)
  public List<UserListItem> list() {
    return users.findByRoleNotOrderByCreatedAtDesc(User.PLATFORM_ADMIN).stream()
        .map(u -> new UserListItem(u.getUserId(), u.getEmail(), u.getFirstName(),
            u.getLastName(), u.getMobileNumber(), u.getRole(), u.getCreatedAt()))
        .toList();
  }

  @Transactional
  public OnboardResponse onboard(OnboardRequest req, UUID actingAdminId) {
    // PARITY: case-insensitive uniqueness; stored lowercased; exact error message.
    if (users.existsByEmailIgnoreCase(req.email())) {
      throw new DuplicateEmailException("A user with this email already exists.");
    }
    featureValidator.validate(req.featureActionAssigned());

    User user = new User();
    user.setEmail(req.email().toLowerCase());
    user.setPasswordHash(passwordEncoder.encode(req.password()));
    user.setFirstName(req.firstName());
    user.setLastName(req.lastName());
    user.setMobileNumber(req.mobileNumber());
    user.setRole(req.role() == null || req.role().isBlank() ? "user" : req.role());
    // PARITY: omitted/empty featureActionAssigned -> hydrate defaults; explicit value used as-is.
    user.setFeatureActionAssigned(
        req.featureActionAssigned() == null || req.featureActionAssigned().isEmpty()
            ? rbac.getDefaultAccess()
            : req.featureActionAssigned());
    user = users.save(user);

    List<UUID> projectIds = req.projectIds() == null ? List.of() : req.projectIds();
    for (UUID projectId : new HashSet<>(projectIds)) {
      // PARITY: assigned_by = acting admin — the only audit trail on grants.
      userProjects.save(new UserProject(user.getUserId(), projectId, actingAdminId));
    }

    return new OnboardResponse(user.getUserId(), user.getEmail(), user.getFirstName(),
        user.getLastName(), user.getMobileNumber(), user.getRole(),
        user.getFeatureActionAssigned(), projectIds);
  }

  /** PARITY: admin may update firstName/lastName/mobileNumber/role — never email/password. */
  @Transactional
  public UserListItem update(UUID userId, AdminUpdateRequest req) {
    User user = users.findById(userId).orElseThrow(AuthService.UserNotFoundException::new);
    boolean roleChanged = false;
    if (req.firstName() != null && !req.firstName().isBlank()) {
      user.setFirstName(req.firstName());
    }
    if (req.lastName() != null && !req.lastName().isBlank()) {
      user.setLastName(req.lastName());
    }
    if (req.mobileNumber() != null) {
      user.setMobileNumber(req.mobileNumber());
    }
    if (req.role() != null && !req.role().isBlank() && !req.role().equals(user.getRole())) {
      user.setRole(req.role());
      roleChanged = true;
    }
    if (roleChanged) {
      snapshots.invalidate(userId); // access change must take effect before JWT expiry
    }
    return new UserListItem(user.getUserId(), user.getEmail(), user.getFirstName(),
        user.getLastName(), user.getMobileNumber(), user.getRole(), user.getCreatedAt());
  }

  @Transactional(readOnly = true)
  public AccessReadResponse readAccess(UUID userId) {
    User user = users.findById(userId).orElseThrow(AuthService.UserNotFoundException::new);
    return new AccessReadResponse(user.getRole(), user.getFeatureActionAssigned(),
        rbac.getUserProjectIds(userId));
  }

  /** PARITY: diff-sync project grants (delete removed, add new with assigned_by). */
  @Transactional
  public AccessReadResponse updateAccess(UUID userId, AccessUpdateRequest req, UUID actingAdminId) {
    User user = users.findById(userId).orElseThrow(AuthService.UserNotFoundException::new);

    if (req.featureActionAssigned() != null) {
      featureValidator.validate(req.featureActionAssigned());
      user.setFeatureActionAssigned(req.featureActionAssigned());
    }

    if (req.projectIds() != null) {
      Set<UUID> desired = new HashSet<>(req.projectIds());
      Set<UUID> current = new HashSet<>(userProjects.findProjectIdsByUserId(userId));
      Set<UUID> toRemove = new HashSet<>(current);
      toRemove.removeAll(desired);
      Set<UUID> toAdd = new HashSet<>(desired);
      toAdd.removeAll(current);
      if (!toRemove.isEmpty()) {
        userProjects.deleteByUserIdAndProjectIdIn(userId, toRemove);
      }
      List<UserProject> additions = new ArrayList<>();
      for (UUID projectId : toAdd) {
        additions.add(new UserProject(userId, projectId, actingAdminId));
      }
      userProjects.saveAll(additions);
    }

    snapshots.invalidate(userId); // stale snapshots must not keep granting old access
    return new AccessReadResponse(user.getRole(), user.getFeatureActionAssigned(),
        rbac.getUserProjectIds(userId));
  }

  public static class DuplicateEmailException extends RuntimeException {
    public DuplicateEmailException(String message) {
      super(message);
    }
  }
}
