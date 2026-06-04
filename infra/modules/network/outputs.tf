output "network_name" {
  description = "VPC name."
  value       = google_compute_network.this.name
}

output "network_self_link" {
  description = "VPC self link."
  value       = google_compute_network.this.self_link
}

output "subnetwork_name" {
  description = "GKE subnet name."
  value       = google_compute_subnetwork.gke.name
}

output "subnetwork_self_link" {
  description = "GKE subnet self link."
  value       = google_compute_subnetwork.gke.self_link
}

output "pod_secondary_name" {
  description = "Pod secondary range name."
  value       = var.pod_secondary_name
}

output "service_secondary_name" {
  description = "Service secondary range name."
  value       = var.service_secondary_name
}

output "gke_node_network_tag" {
  description = "GKE node network tag."
  value       = var.gke_node_network_tag
}
