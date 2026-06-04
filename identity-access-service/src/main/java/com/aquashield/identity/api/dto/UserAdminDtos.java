package com.aquashield.identity.api.dto;

import com.aquashield.identity.domain.FeatureActionEntry;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Admin user-management contract (parity with module_user serializers). */
public final class UserAdminDtos {

  private UserAdminDtos() {}

  public record UserListItem(
      UUID userId, String email, String firstName, String lastName,
      String mobileNumber, String role, OffsetDateTime createdAt) {}

  public record OnboardRequest(
      @NotBlank @Email String email,
      // PARITY: API password policy is min_length=8 only (monolith bypassed Django validators)
      @NotBlank @Size(min = 8) String password,
      @NotBlank String firstName,
      @NotBlank String lastName,
      String mobileNumber,
      String role,
      List<FeatureActionEntry> featureActionAssigned,
      List<UUID> projectIds) {}

  public record OnboardResponse(
      UUID userId, String email, String firstName, String lastName, String mobileNumber,
      String role, List<FeatureActionEntry> featureActionAssigned, List<UUID> projectIds) {}

  /** Admin profile update: firstName/lastName/mobileNumber/role — NOT email/password. */
  public record AdminUpdateRequest(String firstName, String lastName, String mobileNumber, String role) {}

  /** Access update: featureActionAssigned + projectIds only (role lives in profile update). */
  public record AccessUpdateRequest(List<FeatureActionEntry> featureActionAssigned, List<UUID> projectIds) {}

  public record AccessReadResponse(String role, List<FeatureActionEntry> featureActionAssigned, List<UUID> projectIds) {}
}
