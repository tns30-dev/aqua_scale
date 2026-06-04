package com.aquashield.identity.service;

import com.aquashield.identity.domain.FeatureActionEntry;
import com.aquashield.identity.domain.User;
import com.aquashield.identity.repo.ActionControlRepository;
import com.aquashield.identity.repo.FeatureAccessRepository;
import com.aquashield.identity.repo.UserProjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * PARITY ORACLES: each case mirrors a monolith RBACService behavior verified in
 * module_user/test_services.py (cited in the parity spec). These define correctness.
 */
@ExtendWith(MockitoExtension.class)
class RbacServiceTest {

  @Mock UserProjectRepository userProjects;
  @Mock FeatureAccessRepository featureAccess;
  @Mock ActionControlRepository actionControls;
  @InjectMocks RbacService rbac;

  private static User userWith(List<FeatureActionEntry> entries) {
    User u = new User();
    u.setFeatureActionAssigned(entries);
    return u;
  }

  private static User userWithRole(String role) {
    User u = new User();
    u.setRole(role);
    return u;
  }

  // Oracle #1/#2 — project ids passthrough / empty default
  @Test
  void projectIds_returnsAssigned() {
    UUID userId = UUID.randomUUID();
    List<UUID> ids = List.of(UUID.randomUUID(), UUID.randomUUID());
    when(userProjects.findProjectIdsByUserId(userId)).thenReturn(ids);
    assertThat(rbac.getUserProjectIds(userId)).isEqualTo(ids);
  }

  @Test
  void projectIds_emptyWhenNoRows() {
    UUID userId = UUID.randomUUID();
    when(userProjects.findProjectIdsByUserId(userId)).thenReturn(List.of());
    assertThat(rbac.getUserProjectIds(userId)).isEmpty();
  }

  // Oracle #3/#4/#5 — project access = row existence; unknown ids are simply false
  @Test
  void projectAccess_trueWhenRowExists() {
    UUID u = UUID.randomUUID();
    UUID p = UUID.randomUUID();
    when(userProjects.existsByUserIdAndProjectId(u, p)).thenReturn(true);
    assertThat(rbac.hasProjectAccess(u, p)).isTrue();
  }

  @Test
  void projectAccess_falseWhenNoRow_orRandomUuid() {
    UUID u = UUID.randomUUID();
    UUID p = UUID.randomUUID();
    when(userProjects.existsByUserIdAndProjectId(u, p)).thenReturn(false);
    assertThat(rbac.hasProjectAccess(u, p)).isFalse();
  }

  // Oracle #7/#8 — platform admin is the role string only
  @Test
  void platformAdmin_byRoleStringOnly() {
    assertThat(rbac.isPlatformAdmin(userWithRole("platform_admin"))).isTrue();
    assertThat(rbac.isPlatformAdmin(userWithRole("farm_manager"))).isFalse();
    assertThat(rbac.isPlatformAdmin(null)).isFalse();
  }

  // Oracle #9 — wildcard sentinel grants every feature
  @Test
  void featureAccess_wildcardGrantsEverything() {
    User u = userWith(List.of(FeatureActionEntry.wildcard()));
    assertThat(rbac.hasFeatureAccess(u, "anything")).isTrue();
    assertThat(rbac.hasFeatureAccess(u, "user_management")).isTrue();
  }

  // Oracle #10/#11 — specific grants; absence = denied
  @Test
  void featureAccess_specificCodes() {
    User u = userWith(List.of(
        new FeatureActionEntry("overview", List.of()),
        new FeatureActionEntry("realtime_forecast", List.of("ai_forecast"))));
    assertThat(rbac.hasFeatureAccess(u, "overview")).isTrue();
    assertThat(rbac.hasFeatureAccess(u, "user_management")).isFalse();
  }

  // Oracle #12 — empty array denies all
  @Test
  void featureAccess_emptyDeniesAll() {
    User u = userWith(List.of());
    assertThat(rbac.hasFeatureAccess(u, "overview")).isFalse();
  }

  // Oracle #13/#14 — action grants
  @Test
  void actionControl_specificCodes() {
    User u = userWith(List.of(
        new FeatureActionEntry("realtime_forecast", List.of("ai_forecast", "schedule_forecast"))));
    assertThat(rbac.hasActionControl(u, "ai_forecast")).isTrue();
    assertThat(rbac.hasActionControl(u, "onboard_user")).isFalse();
  }

  // Oracle #15 — THE GLOBAL WILDCARD LEAK: "*" in any entry's actions grants ANY action,
  // even one belonging to a different feature. The monolith asserts this on purpose.
  @Test
  void actionControl_perFeatureWildcardLeaksGlobally() {
    User u = userWith(List.of(new FeatureActionEntry("realtime_forecast", List.of("*"))));
    assertThat(rbac.hasActionControl(u, "export_data")).isTrue(); // other feature's action
    assertThat(rbac.hasActionControl(u, "literally_anything")).isTrue();
  }

  // Oracle #16 — empty array denies all actions
  @Test
  void actionControl_emptyDeniesAll() {
    User u = userWith(List.of());
    assertThat(rbac.hasActionControl(u, "export_data")).isFalse();
  }

  // Feature wildcard grants actions too
  @Test
  void actionControl_featureWildcardGrantsAllActions() {
    User u = userWith(List.of(FeatureActionEntry.wildcard()));
    assertThat(rbac.hasActionControl(u, "anything")).isTrue();
  }

  // Malformed tolerance (parity: _iter_entries silently skips garbage)
  @Test
  void malformedEntries_areSkippedSilently() {
    User u = userWith(Arrays.asList(
        null,
        new FeatureActionEntry(null, List.of("x")),
        new FeatureActionEntry("overview", null)));
    assertThat(rbac.hasFeatureAccess(u, "overview")).isTrue();   // entry valid at feature level
    assertThat(rbac.hasActionControl(u, "x")).isFalse();          // null action list skipped
    assertThat(rbac.hasFeatureAccess(u, "other")).isFalse();
  }
}
