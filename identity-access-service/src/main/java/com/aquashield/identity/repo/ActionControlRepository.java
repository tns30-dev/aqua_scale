package com.aquashield.identity.repo;

import com.aquashield.identity.domain.ActionControl;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ActionControlRepository extends JpaRepository<ActionControl, UUID> {
  List<ActionControl> findByDefaultGrantTrue();

  /** PARITY (catalogue endpoints): order_by("name") ascending. */
  List<ActionControl> findAllByOrderByNameAsc();
}
