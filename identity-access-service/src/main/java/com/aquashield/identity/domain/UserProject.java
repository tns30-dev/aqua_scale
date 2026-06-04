package com.aquashield.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PARITY (module_user.UserProject): flat user→project grant; existence of a row IS the
 * access; deleting the row revokes immediately. assigned_by = acting admin (only audit
 * trail on grants — always set it). project_id is a cross-service reference (no FK).
 */
@Entity
@Table(name = "user_projects")
public class UserProject {

  @Id
  @GeneratedValue
  @Column(name = "user_project_id")
  private UUID userProjectId;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @CreationTimestamp
  @Column(name = "assigned_at", updatable = false)
  private OffsetDateTime assignedAt;

  @Column(name = "assigned_by")
  private UUID assignedBy;

  protected UserProject() {}

  public UserProject(UUID userId, UUID projectId, UUID assignedBy) {
    this.userId = userId;
    this.projectId = projectId;
    this.assignedBy = assignedBy;
  }

  public UUID getUserProjectId() { return userProjectId; }
  public UUID getUserId() { return userId; }
  public UUID getProjectId() { return projectId; }
  public OffsetDateTime getAssignedAt() { return assignedAt; }
  public UUID getAssignedBy() { return assignedBy; }
}
