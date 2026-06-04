package com.aquashield.audit.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Platform envelopes: 404 = {"detail": "Not found."} (same as project-service). */
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(AuditQueryController.NotFoundException.class)
  public ResponseEntity<Map<String, String>> notFound(AuditQueryController.NotFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", "Not found."));
  }
}
