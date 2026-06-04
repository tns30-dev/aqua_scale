package com.aquashield.identity.api;

import com.aquashield.identity.service.AuthService;
import com.aquashield.identity.service.FeatureActionValidator;
import com.aquashield.identity.service.RefreshTokenService;
import com.aquashield.identity.service.UserAdminService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Error envelopes. PARITY notes:
 *  - login failure: 401 {"detail": "No active account found with the given credentials"}
 *  - user not found: 404 {"error": "User not found"} (monolith user views diverge from DRF)
 *  - validation: 400 {"detail": ...}
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(AuthService.InvalidCredentialsException.class)
  ResponseEntity<Map<String, String>> invalidCredentials() {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("detail", AuthService.GENERIC_LOGIN_FAILURE));
  }

  @ExceptionHandler(RefreshTokenService.InvalidRefreshTokenException.class)
  ResponseEntity<Map<String, String>> invalidRefresh(RefreshTokenService.InvalidRefreshTokenException e) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(AuthService.RateLimitedException.class)
  ResponseEntity<Map<String, String>> rateLimited() {
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .body(Map.of("detail", "Too many login attempts. Try again later."));
  }

  @ExceptionHandler(AuthService.UserNotFoundException.class)
  ResponseEntity<Map<String, String>> userNotFound() {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("error", "User not found"));
  }

  @ExceptionHandler(UserAdminService.DuplicateEmailException.class)
  ResponseEntity<Map<String, String>> duplicateEmail(UserAdminService.DuplicateEmailException e) {
    return ResponseEntity.badRequest().body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(FeatureActionValidator.InvalidFeatureActionException.class)
  ResponseEntity<Map<String, String>> invalidFeatureAction(FeatureActionValidator.InvalidFeatureActionException e) {
    return ResponseEntity.badRequest().body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, String>> beanValidation(MethodArgumentNotValidException e) {
    String msg = e.getBindingResult().getFieldErrors().stream()
        .map(f -> f.getField() + ": " + f.getDefaultMessage())
        .findFirst()
        .orElse("Validation failed");
    return ResponseEntity.badRequest().body(Map.of("detail", msg));
  }
}
