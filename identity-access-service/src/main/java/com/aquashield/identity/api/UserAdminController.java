package com.aquashield.identity.api;

import com.aquashield.identity.api.dto.UserAdminDtos.AccessReadResponse;
import com.aquashield.identity.api.dto.UserAdminDtos.AccessUpdateRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.AdminUpdateRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.OnboardRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.OnboardResponse;
import com.aquashield.identity.api.dto.UserAdminDtos.UserListItem;
import com.aquashield.identity.config.JwtAuthFilter.Principal;
import com.aquashield.identity.service.UserAdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** PARITY: every endpoint is platform_admin-only (IsPlatformAdmin). */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class UserAdminController {

  private final UserAdminService admin;

  public UserAdminController(UserAdminService admin) {
    this.admin = admin;
  }

  @GetMapping
  public List<UserListItem> list() {
    return admin.list();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public OnboardResponse onboard(@Valid @RequestBody OnboardRequest body,
                                 @AuthenticationPrincipal Principal principal) {
    return admin.onboard(body, principal.userId());
  }

  @PatchMapping("/{userId}")
  public UserListItem update(@PathVariable UUID userId, @RequestBody AdminUpdateRequest body) {
    return admin.update(userId, body);
  }

  @GetMapping("/{userId}/access")
  public AccessReadResponse readAccess(@PathVariable UUID userId) {
    return admin.readAccess(userId);
  }

  @PutMapping("/{userId}/access")
  public AccessReadResponse updateAccess(@PathVariable UUID userId,
                                         @RequestBody AccessUpdateRequest body,
                                         @AuthenticationPrincipal Principal principal) {
    return admin.updateAccess(userId, body, principal.userId());
  }
}
