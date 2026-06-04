package com.aquashield.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * PARITY (module_user.User): email is the login identifier; "username" is the COMPUTED
 * full name (never stored); role is free text where only "platform_admin" is privileged;
 * feature_action_assigned JSONB is the permission source of truth; no last_login.
 */
@Entity
@Table(name = "users")
public class User {

  public static final String PLATFORM_ADMIN = "platform_admin";

  @Id
  @GeneratedValue
  @Column(name = "user_id")
  private UUID userId;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "first_name", nullable = false)
  private String firstName;

  @Column(name = "last_name", nullable = false)
  private String lastName;

  @Column(name = "mobile_number")
  private String mobileNumber;

  @Column(nullable = false)
  private String role = "user";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "feature_action_assigned", nullable = false)
  private List<FeatureActionEntry> featureActionAssigned = new ArrayList<>();

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  /** PARITY: username = "{first_name} {last_name}" (User.get_full_name). */
  public String fullName() {
    return firstName + " " + lastName;
  }

  /** PARITY: platform admin is determined solely by the role string. */
  public boolean isPlatformAdmin() {
    return PLATFORM_ADMIN.equals(role);
  }

  // --- accessors ---
  public UUID getUserId() { return userId; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
  public String getFirstName() { return firstName; }
  public void setFirstName(String firstName) { this.firstName = firstName; }
  public String getLastName() { return lastName; }
  public void setLastName(String lastName) { this.lastName = lastName; }
  public String getMobileNumber() { return mobileNumber; }
  public void setMobileNumber(String mobileNumber) { this.mobileNumber = mobileNumber; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public List<FeatureActionEntry> getFeatureActionAssigned() { return featureActionAssigned; }
  public void setFeatureActionAssigned(List<FeatureActionEntry> v) { this.featureActionAssigned = v; }
  public boolean isActive() { return active; }
  public void setActive(boolean active) { this.active = active; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
