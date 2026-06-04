package com.aquashield.pond.domain;

import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.Set;
import java.util.UUID;

/**
 * PARITY (module_pond.Pond): five-state operational status (admin/ops-set; no transition
 * machine); GPS/biomass/company metadata lives INSIDE the metadata JSONB, not columns;
 * is_active == status=='active' exactly. photo_url exposed (DDL truth — the monolith API
 * silently dropped it). healthStatus is NEVER a backend field (frontend computes it).
 */
@Entity
@Table(name = "ponds")
public class Pond {

  public static final Set<String> STATUSES =
      Set.of("active", "draining", "cleaning", "maintenance", "decommissioned");

  @Id
  @GeneratedValue
  @Column(name = "pond_id")
  private UUID pondId;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "text")
  private String description;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private JsonNode metadata;

  @Column(nullable = false)
  private String status = "active";

  @Column(name = "photo_url", columnDefinition = "text")
  private String photoUrl;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  /** PARITY: only 'active' is active. */
  public boolean isActive() {
    return "active".equals(status);
  }

  public UUID getPondId() { return pondId; }
  public UUID getProjectId() { return projectId; }
  public void setProjectId(UUID projectId) { this.projectId = projectId; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public JsonNode getMetadata() { return metadata; }
  public void setMetadata(JsonNode metadata) { this.metadata = metadata; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getPhotoUrl() { return photoUrl; }
  public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
