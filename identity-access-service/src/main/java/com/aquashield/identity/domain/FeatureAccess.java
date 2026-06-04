package com.aquashield.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** PARITY (module_user.FeatureAccess): feature catalogue; is_default drives onboarding grants. */
@Entity
@Table(name = "feature_access")
public class FeatureAccess {

  @Id
  @GeneratedValue
  @Column(name = "feature_access_id")
  private UUID featureAccessId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, unique = true)
  private String code;

  @Column(name = "is_default", nullable = false)
  private boolean defaultGrant;

  public UUID getFeatureAccessId() { return featureAccessId; }
  public String getName() { return name; }
  public String getCode() { return code; }
  public boolean isDefaultGrant() { return defaultGrant; }
}
