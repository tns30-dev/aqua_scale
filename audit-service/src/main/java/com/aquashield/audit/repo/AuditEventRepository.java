package com.aquashield.audit.repo;

import com.aquashield.audit.domain.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

/**
 * Append-only access: save (insert) + reads. No delete/update entry points are exposed
 * by the service layer; the DB trigger backs that up (V1__init.sql).
 */
public interface AuditEventRepository
    extends JpaRepository<AuditEvent, UUID>, JpaSpecificationExecutor<AuditEvent> {
}
