output "cloud_armor_policy_name" {
  description = "Cloud Armor policy name."
  value       = google_compute_security_policy.api_edge.name
}
