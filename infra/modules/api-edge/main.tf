resource "google_compute_global_address" "api" {
  project      = var.project_id
  name         = var.address_name
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  description  = "AquaShield dev public API Gateway address."
}

resource "google_compute_managed_ssl_certificate" "api" {
  count = var.api_domain == "" ? 0 : 1

  project = var.project_id
  name    = var.certificate_name

  managed {
    domains = [var.api_domain]
  }

  lifecycle {
    create_before_destroy = true
  }
}
