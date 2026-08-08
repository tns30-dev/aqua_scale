package com.aquashield.ingestion.repo;

import com.aquashield.ingestion.domain.Entities.SensorMessage;
import com.aquashield.ingestion.domain.Entities.SensorReadingRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public final class Repos {

  private Repos() {}

  public interface SensorMessageRepository extends JpaRepository<SensorMessage, UUID> {
    boolean existsByIotDeviceIdAndSeqNo(UUID iotDeviceId, long seqNo);
  }

  public interface SensorReadingRepository extends JpaRepository<SensorReadingRow, UUID> {
    List<SensorReadingRow> findByPondIdOrderByMeasuredAtDesc(UUID pondId);

    List<SensorReadingRow> findByPondIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
        UUID pondId, OffsetDateTime start, OffsetDateTime end);

    List<SensorReadingRow> findByProjectIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
        UUID projectId, OffsetDateTime start, OffsetDateTime end);

    Optional<SensorReadingRow> findFirstByProjectIdAndPondIdOrderByMeasuredAtDesc(
        UUID projectId, UUID pondId);

    interface EnergyHourTotal {
      Instant getHourStart();
      Double getKwh();
    }

    @Query(value = """
        select
          r.hour_start as "hourStart",
          r.kwh as kwh
        from ingestion.energy_hourly_readings r
        where r.project_id = :projectId
          and r.hour_start >= date_trunc('hour', cast(:start as timestamptz))
          and r.hour_start <= date_trunc('hour', cast(:end as timestamptz))
        order by r.hour_start
        """, nativeQuery = true)
    List<EnergyHourTotal> findProjectElectricityHourly(
        @Param("projectId") UUID projectId,
        @Param("start") OffsetDateTime start,
        @Param("end") OffsetDateTime end);

    interface PondParameterBucketAverage {
      UUID getPondId();
      String getParameter();
      Instant getBucketStart();
      Double getAvgValue();
      Long getSampleCount();
    }

    interface PondCommonParameterBucketAverages {
      UUID getPondId();
      Instant getBucketStart();
      Double getAmmoniaAvg();
      Long getAmmoniaCount();
      Double getAmmoniumAvg();
      Long getAmmoniumCount();
      Double getDissolvedOxygenAvg();
      Long getDissolvedOxygenCount();
      Double getTurbidityAvg();
      Long getTurbidityCount();
      Double getPhAvg();
      Long getPhCount();
      Double getAlkalinityAvg();
      Long getAlkalinityCount();
      Double getNitriteAvg();
      Long getNitriteCount();
      Double getTotalHardnessAvg();
      Long getTotalHardnessCount();
      Double getTemperatureAvg();
      Long getTemperatureCount();
      Double getSalinityAvg();
      Long getSalinityCount();
      Double getNitrateAvg();
      Long getNitrateCount();
      Double getTanAvg();
      Long getTanCount();
    }

    @Query(value = """
        select
          r.pond_id as "pondId",
          (date_trunc(
             case :grouping
               when 'hourly' then 'hour'
               when 'weekly' then 'week'
               when 'monthly' then 'month'
               else 'day'
             end,
             r.measured_at at time zone :timezone
          ) at time zone :timezone) as "bucketStart",
          avg((r.reading_values ->> 'ammonia')::double precision) as "ammoniaAvg",
          count(r.reading_values ->> 'ammonia') as "ammoniaCount",
          avg((r.reading_values ->> 'ammonium')::double precision) as "ammoniumAvg",
          count(r.reading_values ->> 'ammonium') as "ammoniumCount",
          avg((r.reading_values ->> 'dissolved_oxygen')::double precision) as "dissolvedOxygenAvg",
          count(r.reading_values ->> 'dissolved_oxygen') as "dissolvedOxygenCount",
          avg((r.reading_values ->> 'turbidity')::double precision) as "turbidityAvg",
          count(r.reading_values ->> 'turbidity') as "turbidityCount",
          avg((r.reading_values ->> 'ph')::double precision) as "phAvg",
          count(r.reading_values ->> 'ph') as "phCount",
          avg((r.reading_values ->> 'alkalinity')::double precision) as "alkalinityAvg",
          count(r.reading_values ->> 'alkalinity') as "alkalinityCount",
          avg((r.reading_values ->> 'nitrite')::double precision) as "nitriteAvg",
          count(r.reading_values ->> 'nitrite') as "nitriteCount",
          avg((r.reading_values ->> 'total_hardness')::double precision) as "totalHardnessAvg",
          count(r.reading_values ->> 'total_hardness') as "totalHardnessCount",
          avg((r.reading_values ->> 'temperature')::double precision) as "temperatureAvg",
          count(r.reading_values ->> 'temperature') as "temperatureCount",
          avg((r.reading_values ->> 'salinity')::double precision) as "salinityAvg",
          count(r.reading_values ->> 'salinity') as "salinityCount",
          avg((r.reading_values ->> 'nitrate')::double precision) as "nitrateAvg",
          count(r.reading_values ->> 'nitrate') as "nitrateCount",
          avg((r.reading_values ->> 'tan')::double precision) as "tanAvg",
          count(r.reading_values ->> 'tan') as "tanCount"
        from ingestion.sensor_readings r
        where r.pond_id = :pondId
          and r.measured_at >= :start
          and r.measured_at <= :end
        group by r.pond_id, 2
        order by r.pond_id, 2
        """, nativeQuery = true)
    List<PondCommonParameterBucketAverages> findPondCommonParameterBucketAverages(
        @Param("pondId") UUID pondId,
        @Param("start") OffsetDateTime start,
        @Param("end") OffsetDateTime end,
        @Param("timezone") String timezone,
        @Param("grouping") String grouping);

    @Query(value = """
        select
          r.pond_id as "pondId",
          kv.key as parameter,
          (date_trunc(
             case :grouping
               when 'hourly' then 'hour'
               when 'weekly' then 'week'
               when 'monthly' then 'month'
               else 'day'
             end,
             r.measured_at at time zone :timezone
           ) at time zone :timezone) as "bucketStart",
          avg(kv.value::double precision) as "avgValue",
          count(*) as "sampleCount"
        from ingestion.sensor_readings r
        join lateral jsonb_each_text(r.reading_values) kv(key, value) on true
        where r.pond_id = :pondId
          and r.measured_at >= :start
          and r.measured_at <= :end
          and kv.key in (:parameters)
        group by r.pond_id, kv.key, 3
        order by r.pond_id, kv.key, 3
        """, nativeQuery = true)
    List<PondParameterBucketAverage> findPondParameterBucketAverages(
        @Param("pondId") UUID pondId,
        @Param("start") OffsetDateTime start,
        @Param("end") OffsetDateTime end,
        @Param("timezone") String timezone,
        @Param("grouping") String grouping,
        @Param("parameters") java.util.Collection<String> parameters);

    /** Latest reading timestamp per pond for a project (Overview bootstrap). */
    @Query(value = """
        select distinct on (r.pond_id) r.*
        from ingestion.sensor_readings r
        where r.project_id = :projectId
          and r.pond_id is not null
        order by r.pond_id, r.measured_at desc, r.reading_id
        """, nativeQuery = true)
    List<SensorReadingRow> findLatestByProject(UUID projectId);

    /** Latest reading timestamp per requested pond for a project (Overview bootstrap). */
    @Query(value = """
        select distinct on (r.pond_id) r.*
        from ingestion.sensor_readings r
        where r.project_id = :projectId
          and r.pond_id in (:pondIds)
        order by r.pond_id, r.measured_at desc, r.reading_id
        """, nativeQuery = true)
    List<SensorReadingRow> findLatestByProjectAndPondIds(UUID projectId,
                                                         java.util.Collection<UUID> pondIds);

    /** Batched min/max per pond (pond-comparison options window). */
    @Query(
        "select r.pondId, min(r.measuredAt), max(r.measuredAt) from SensorReadingRow r"
        + " where r.pondId in :pondIds group by r.pondId")
    List<Object[]> findReadingWindows(java.util.Collection<UUID> pondIds);

    long countBySensorMessageId(UUID sensorMessageId);
  }
}
