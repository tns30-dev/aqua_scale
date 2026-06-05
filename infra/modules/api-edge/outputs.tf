output "address_name" {
  description = "Global static IP address name."
  value       = google_compute_global_address.api.name
}

output "address" {
  description = "Global static IPv4 address."
  value       = google_compute_global_address.api.address
}

output "certificate_name" {
  description = "Google-managed SSL certificate name."
  value       = var.api_domain == "" ? null : google_compute_managed_ssl_certificate.api[0].name
}

output "certificate_domains" {
  description = "Domains requested for the Google-managed SSL certificate."
  value       = var.api_domain == "" ? [] : google_compute_managed_ssl_certificate.api[0].managed[0].domains
}
