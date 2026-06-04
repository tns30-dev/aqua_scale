package com.aquashield.project.api;

import com.aquashield.project.api.dto.ProjectDtos.GrowthIndicatorDto;
import com.aquashield.project.api.dto.ProjectDtos.ParameterTypeDto;
import com.aquashield.project.api.dto.ProjectDtos.ProfileTypeDto;
import com.aquashield.project.repo.Repositories.GrowthIndicatorRepository;
import com.aquashield.project.repo.Repositories.ParameterTypeRepository;
import com.aquashield.project.repo.Repositories.ProfileTypeRepository;
import com.aquashield.project.service.ProjectCache;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Catalogue endpoints — any authenticated user (PARITY: IsAuthenticated only, no
 * membership). PARITY: flat JSON arrays (no pagination wrapper), snake_case keys,
 * ordered by code. Responses are Redis-cached (read-through, TTL) as JSON strings.
 */
@RestController
public class CatalogueController {

  private final ProfileTypeRepository profileTypes;
  private final ParameterTypeRepository parameterTypes;
  private final GrowthIndicatorRepository growthIndicators;
  private final ProjectCache cache;
  private final ObjectMapper mapper;

  public CatalogueController(ProfileTypeRepository profileTypes,
                             ParameterTypeRepository parameterTypes,
                             GrowthIndicatorRepository growthIndicators,
                             ProjectCache cache, ObjectMapper mapper) {
    this.profileTypes = profileTypes;
    this.parameterTypes = parameterTypes;
    this.growthIndicators = growthIndicators;
    this.cache = cache;
    this.mapper = mapper;
  }

  @GetMapping(value = "/api/profile-types", produces = MediaType.APPLICATION_JSON_VALUE)
  public String profileTypes() {
    return cache.catalogue("profile-types", () -> toJson(
        profileTypes.findAllByOrderByCodeAsc().stream().map(ProfileTypeDto::from).toList()));
  }

  @GetMapping(value = "/api/parameter-types", produces = MediaType.APPLICATION_JSON_VALUE)
  public String parameterTypes() {
    return cache.catalogue("parameter-types", () -> toJson(
        parameterTypes.findAllByOrderByParameterCodeAsc().stream()
            .map(ParameterTypeDto::from).toList()));
  }

  @GetMapping(value = "/api/growth-indicators", produces = MediaType.APPLICATION_JSON_VALUE)
  public String growthIndicators() {
    return cache.catalogue("growth-indicators", () -> toJson(
        growthIndicators.findAllByOrderByCodeAsc().stream()
            .map(g -> new GrowthIndicatorDto(g.getGrowthIndicatorId(), g.getCode(),
                g.getName(), g.getUnit(), g.getDataType()))
            .toList()));
  }

  private String toJson(List<?> value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Cannot serialize catalogue", e);
    }
  }
}
