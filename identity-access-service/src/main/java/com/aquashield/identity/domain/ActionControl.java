package com.aquashield.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** PARITY (module_user.ActionControl): action catalogue under a parent feature. */
@Entity
@Table(name = "action_control")
public class ActionControl {

  @Id
  @GeneratedValue
  @Column(name = "action_control_id")
  private UUID actionControlId;

  @Column(name = "feature_access_id", nullable = false)
  private UUID featureAccessId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, unique = true)
  private String code;

  @Column(name = "is_default", nullable = false)
  private boolean defaultGrant;

  public UUID getActionControlId() { return actionControlId; }
  public UUID getFeatureAccessId() { return featureAccessId; }
  public String getName() { return name; }
  public String getCode() { return code; }
  public boolean isDefaultGrant() { return defaultGrant; }
}
