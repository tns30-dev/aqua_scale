package com.aquashield.identity.repo;

import com.aquashield.identity.domain.FeatureAccess;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FeatureAccessRepository extends JpaRepository<FeatureAccess, UUID> {
  List<FeatureAccess> findByDefaultGrantTrue();

  /** PARITY (catalogue endpoints): order_by("name") ascending. */
  List<FeatureAccess> findAllByOrderByNameAsc();
}
