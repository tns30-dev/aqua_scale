resource "google_compute_security_policy" "api_edge" {
  name        = var.cloud_armor_policy_name
  description = "Cloud Armor policy for AquaShield API and WSS edge."

  rule {
    action      = "throttle"
    priority    = 1000
    description = "Rate limit all public API clients by source IP."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.rate_limit_requests_per_minute
        interval_sec = 60
      }
    }
  }

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow after explicit protection rules."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}
