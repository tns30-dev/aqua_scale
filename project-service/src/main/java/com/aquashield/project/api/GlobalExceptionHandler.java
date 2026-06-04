package com.aquashield.project.api;

import com.aquashield.project.service.ProjectAppService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** PARITY envelopes: 404 = DRF-style {"detail": "Not found."}; 400 = {"detail": msg}. */
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ProjectAppService.NotFoundException.class)
  ResponseEntity<Map<String, String>> notFound() {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", "Not found."));
  }

  @ExceptionHandler(ProjectAppService.BadRequestException.class)
  ResponseEntity<Map<String, String>> badRequest(ProjectAppService.BadRequestException e) {
    return ResponseEntity.badRequest().body(Map.of("detail", e.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, String>> beanValidation(MethodArgumentNotValidException e) {
    String msg = e.getBindingResult().getFieldErrors().stream()
        .map(f -> f.getField() + ": " + f.getDefaultMessage())
        .findFirst().orElse("Validation failed");
    return ResponseEntity.badRequest().body(Map.of("detail", msg));
  }
}
