package com.aquashield.identity.repo;

import com.aquashield.identity.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

  /** PARITY: login + uniqueness checks are case-insensitive on email. */
  Optional<User> findByEmailIgnoreCase(String email);

  boolean existsByEmailIgnoreCase(String email);

  /** PARITY: GET /api/users hides platform_admin rows and orders by -created_at. */
  List<User> findByRoleNotOrderByCreatedAtDesc(String role);
}
