locals {
  service_repositories = [
    "identity-access-service",
    "project-service",
    "pond-service",
    "sensor-service",
    "ingestion-service",
    "notification-service",
    "realtime-gateway",
    "analytics-service",
    "audit-service"
  ]

  required_apis = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iamcredentials.googleapis.com",
    "servicenetworking.googleapis.com"
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_apis

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

module "network" {
  source = "../../modules/network"

  project_id                   = var.project_id
  region                       = var.region
  network_name                 = "aquashield-dev-vpc"
  subnet_name                  = "aquashield-dev-gke-subnet"
  subnet_cidr                  = var.gke_subnet_cidr
  pod_secondary_name           = "aquashield-dev-pods"
  pod_secondary_cidr           = var.pod_secondary_cidr
  service_secondary_name       = "aquashield-dev-services"
  service_secondary_cidr       = var.service_secondary_cidr
  gke_node_network_tag         = "aquashield-dev-gke-node"
  enable_cloud_nat             = true
  enable_private_google_access = true

  depends_on = [google_project_service.required]
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id   = var.project_id
  region       = var.region
  repositories = local.service_repositories

  depends_on = [google_project_service.required]
}

module "gke" {
  source = "../../modules/gke"

  project_id              = var.project_id
  location                = var.gke_cluster_location
  cluster_name            = "aquashield-dev-gke"
  network_self_link       = module.network.network_self_link
  subnetwork_self_link    = module.network.subnetwork_self_link
  pod_secondary_name      = module.network.pod_secondary_name
  service_secondary_name  = module.network.service_secondary_name
  node_pool_name          = "aquashield-dev-primary"
  node_machine_type       = var.node_machine_type
  min_node_count          = var.min_node_count
  max_node_count          = var.max_node_count
  gke_node_network_tag    = module.network.gke_node_network_tag
  master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  enable_private_nodes    = true
  enable_private_endpoint = false

  depends_on = [google_project_service.required]
}

module "security" {
  source = "../../modules/security"

  cloud_armor_policy_name = "aquashield-dev-api-edge"
}
