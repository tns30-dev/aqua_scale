package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PARITY (module_project.Project): owner column is project_owner_id (NOT owner_id);
 * owner is a cross-service user reference (plain UUID). Default ordering -created_at.
 */
@Entity
@Table(name = "projects")
public class Project {

  @Id
  @GeneratedValue
  @Column(name = "project_id")
  private UUID projectId;

  @Column(name = "project_owner_id", nullable = false)
  private UUID ownerUserId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "profile_type_id")
  private ProfileType profileType;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "text")
  private String description;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "created_by")
  private UUID createdBy;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  @Column(name = "updated_by")
  private UUID updatedBy;

  // --- accessors ---
  public UUID getProjectId() { return projectId; }
  public UUID getOwnerUserId() { return ownerUserId; }
  public void setOwnerUserId(UUID ownerUserId) { this.ownerUserId = ownerUserId; }
  public ProfileType getProfileType() { return profileType; }
  public void setProfileType(ProfileType profileType) { this.profileType = profileType; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
  public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
