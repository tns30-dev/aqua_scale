package com.aquashield.identity.api.dto;

import com.aquashield.identity.domain.FeatureActionEntry;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

/**
 * Auth API contract. PARITY: the {user, projects} envelope is shared by login and /me;
 * user.username is the computed full name; featureActionAssigned keeps snake_case inner
 * keys (handled by FeatureActionEntry's @JsonProperty). DIVERGENCE (planned): tokens are
 * returned in the body for the bearer model instead of HttpOnly cookies.
 */
public final class AuthDtos {

  private AuthDtos() {}

  public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

  public record RefreshRequest(@NotBlank String refreshToken) {}

  public record SessionUser(
      UUID userId,
      String username,
      String role,
      List<FeatureActionEntry> featureActionAssigned) {}

  /**
   * Project reference in the session envelope. name/profileType enrichment requires the
   * Project Service (gRPC) — until it exists only projectId is populated.
   */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record ProjectRef(UUID projectId, String name, UUID profileTypeId, String profileType) {
    public static ProjectRef idOnly(UUID projectId) {
      return new ProjectRef(projectId, null, null, null);
    }
  }

  public record LoginResponse(
      String token,
      String refreshToken,
      SessionUser user,
      List<ProjectRef> projects) {}

  public record RefreshResponse(String token, String refreshToken) {}

  public record MeResponse(SessionUser user, List<ProjectRef> projects) {}

  public record UpdateMeRequest(String firstName, String lastName, String mobileNumber) {}
}
