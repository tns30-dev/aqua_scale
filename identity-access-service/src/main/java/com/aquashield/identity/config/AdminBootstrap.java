package com.aquashield.identity.config;

import com.aquashield.common.authz.FeatureActionEntry;
import com.aquashield.identity.domain.User;
import com.aquashield.identity.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

/**
 * Seeds an initial platform admin when the users table is empty (local/dev/demo).
 * Credentials come from env; no defaults in cloud — set via Secret.
 */
@Configuration
public class AdminBootstrap {

  private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

  @Bean
  CommandLineRunner seedAdmin(UserRepository users, PasswordEncoder encoder,
                              @Value("${BOOTSTRAP_ADMIN_EMAIL:}") String email,
                              @Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String password) {
    return args -> {
      if (users.count() > 0 || email.isBlank() || password.isBlank()) {
        return;
      }
      User admin = new User();
      admin.setEmail(email.toLowerCase());
      admin.setPasswordHash(encoder.encode(password));
      admin.setFirstName("Platform");
      admin.setLastName("Admin");
      admin.setRole(User.PLATFORM_ADMIN);
      // PARITY: admin wildcard sentinel
      admin.setFeatureActionAssigned(List.of(FeatureActionEntry.wildcard()));
      users.save(admin);
      log.warn("Bootstrap platform admin created for {} — change the password.", email);
    };
  }
}
