package com.aquashield.pond.jobs;

import com.aquashield.pond.service.DailyHealthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

@Component
@ConditionalOnProperty(name = "aquashield.daily-health.job.enabled", havingValue = "true")
public class DailyHealthJobRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DailyHealthJobRunner.class);

  private final DailyHealthService dailyHealth;
  private final ConfigurableApplicationContext context;
  private final ZoneId zone;

  public DailyHealthJobRunner(
      DailyHealthService dailyHealth,
      ConfigurableApplicationContext context,
      @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.dailyHealth = dailyHealth;
    this.context = context;
    this.zone = ZoneId.of(timezone);
  }

  @Override
  public void run(ApplicationArguments args) {
    LocalDate endDate = args.containsOption("date")
        ? LocalDate.parse(requiredOption(args, "date"))
        : LocalDate.now(zone).minusDays(1);
    int backfill = args.containsOption("backfill")
        ? Integer.parseInt(requiredOption(args, "backfill"))
        : 1;
    if (backfill < 1) {
      throw new IllegalArgumentException("--backfill must be at least 1");
    }

    for (int daysAgo = backfill - 1; daysAgo >= 0; daysAgo--) {
      DailyHealthService.DailyHealthSummary summary = dailyHealth.compute(endDate.minusDays(daysAgo));
      log.info("Daily health completed: {}", summary.asLogLine());
    }

    int exitCode = SpringApplication.exit(context, () -> 0);
    System.exit(exitCode);
  }

  private static String requiredOption(ApplicationArguments args, String name) {
    var values = args.getOptionValues(name);
    if (values == null || values.isEmpty() || values.get(0).isBlank()) {
      throw new IllegalArgumentException("--" + name + " must have a value");
    }
    return values.get(0);
  }
}
