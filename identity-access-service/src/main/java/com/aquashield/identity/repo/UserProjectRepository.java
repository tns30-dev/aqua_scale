package com.aquashield.identity.repo;

import com.aquashield.identity.domain.UserProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UserProjectRepository extends JpaRepository<UserProject, UUID> {

  @Query("select up.projectId from UserProject up where up.userId = :userId")
  List<UUID> findProjectIdsByUserId(@Param("userId") UUID userId);

  boolean existsByUserIdAndProjectId(UUID userId, UUID projectId);

  List<UserProject> findByUserId(UUID userId);

  void deleteByUserIdAndProjectIdIn(UUID userId, Collection<UUID> projectIds);
}
