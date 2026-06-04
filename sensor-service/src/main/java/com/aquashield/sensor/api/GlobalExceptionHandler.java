package com.aquashield.sensor.api;

import com.aquashield.sensor.service.SensorRegistryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(SensorRegistryService.NotFound.class)
  ResponseEntity<Map<String, String>> notFound() {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", "Not found."));
  }

  @ExceptionHandler(SensorRegistryService.BadRequest.class)
  ResponseEntity<Map<String, String>> badRequest(SensorRegistryService.BadRequest e) {
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
