package com.aquashield.pond.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * PARITY (module_pond.Cycle): status in {ongoing, completed, terminated}; end_date NULL
 * means ongoing; current_day is 1-BASED (today - start + 1 for ongoing); NO
 * one-ongoing-per-pond constraint exists (parity — get_active_cycle just takes the
 * newest). Display name strings are pinned by oracle.
 */
@Entity
@Table(name = "cycles")
public class Cycle {

  public static final Set<String> STATUSES = Set.of("ongoing", "completed", "terminated");

  @Id
  @GeneratedValue
  @Column(name = "cycle_id")
  private UUID cycleId;

  @Column(name = "pond_id", nullable = false)
  private UUID pondId;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date")
  private LocalDate endDate;

  @Column(nullable = false)
  private String status = "ongoing";

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  @Column(name = "created_by")
  private UUID createdBy;

  @Column(name = "updated_by")
  private UUID updatedBy;

  protected Cycle() {}

  public Cycle(UUID pondId, LocalDate startDate, String status, UUID createdBy) {
    this.pondId = pondId;
    this.startDate = startDate;
    this.status = status;
    this.createdBy = createdBy;
    this.updatedBy = createdBy;
  }

  /** PARITY (current_day): 1-based; ongoing→today-based; else end_date-based; else 0. */
  public int currentDay(LocalDate today) {
    if (startDate == null) {
      return 0;
    }
    if ("ongoing".equals(status)) {
      return (int) ChronoUnit.DAYS.between(startDate, today) + 1;
    }
    if (endDate != null) {
      return (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }
    return 0;
  }

  /** PARITY (duration_days): like current_day but falls back to today when no end_date. */
  public int durationDays(LocalDate today) {
    if (startDate == null) {
      return 0;
    }
    LocalDate end = endDate != null ? endDate : today;
    return (int) ChronoUnit.DAYS.between(startDate, end) + 1;
  }

  public boolean isOngoing() {
    return "ongoing".equals(status);
  }

  /** PARITY strings: "Cycle {Mon YYYY} - {Mon YYYY}" / "- Ongoing" / "Unknown Cycle". */
  public String displayName() {
    if (startDate == null) {
      return "Unknown Cycle";
    }
    String start = monYear(startDate);
    if (endDate != null) {
      return "Cycle " + start + " - " + monYear(endDate);
    }
    return "Cycle " + start + " - Ongoing";
  }

  private static String monYear(LocalDate d) {
    return d.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH) + " " + d.getYear();
  }

  public UUID getCycleId() { return cycleId; }
  public UUID getPondId() { return pondId; }
  public LocalDate getStartDate() { return startDate; }
  public LocalDate getEndDate() { return endDate; }
  public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
