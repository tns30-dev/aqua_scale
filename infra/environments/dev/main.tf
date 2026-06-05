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
    "bigquery.googleapis.com",
    "bigtableadmin.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "redis.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "sts.googleapis.com"
  ])
}

data "google_project" "current" {
  project_id = var.project_id
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
  enable_private_service_access = (
    var.enable_cloud_sql ||
    var.enable_memorystore
  )

  depends_on = [google_project_service.required]
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id   = var.project_id
  region       = var.region
  repositories = local.service_repositories

  depends_on = [google_project_service.required]
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  project_id                   = var.project_id
  github_repository            = var.github_repository
  artifact_registry_location   = var.region
  artifact_registry_repository = local.service_repositories

  depends_on = [
    google_project_service.required,
    module.artifact_registry
  ]
}

resource "google_project_iam_member" "gke_node_artifact_registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"

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

module "managed_data" {
  source = "../../modules/managed-data"

  project_id                    = var.project_id
  project_number                = data.google_project.current.number
  region                        = var.region
  network_self_link             = module.network.network_self_link
  enable_cloud_sql              = var.enable_cloud_sql
  enable_memorystore            = var.enable_memorystore
  enable_pubsub                 = var.enable_pubsub
  enable_bigtable               = var.enable_bigtable
  enable_bigquery               = var.enable_bigquery
  cloud_sql_tier                = var.cloud_sql_tier
  cloud_sql_deletion_protection = var.cloud_sql_deletion_protection
  redis_memory_size_gb          = var.redis_memory_size_gb
  bigtable_zone                 = var.gke_cluster_location
  bigtable_num_nodes            = var.bigtable_num_nodes
  bigtable_deletion_protection  = var.bigtable_deletion_protection
  kubernetes_namespace          = "aquashield-dev"

  depends_on = [
    google_project_service.required,
    module.network
  ]
}

module "security" {
  source = "../../modules/security"
  count  = var.enable_cloud_armor ? 1 : 0

  cloud_armor_policy_name = "aquashield-dev-api-edge"
}

module "api_edge" {
  source = "../../modules/api-edge"
  count  = var.enable_public_api_edge ? 1 : 0

  project_id       = var.project_id
  address_name     = var.api_edge_address_name
  certificate_name = var.api_edge_certificate_name
  api_domain       = var.api_domain

  depends_on = [google_project_service.required]
}

module "aws_iot_bridge" {
  source = "../../modules/aws-iot-bridge"
  count  = var.enable_aws_iot_bridge ? 1 : 0

  project_id      = var.project_id
  project_number  = data.google_project.current.number
  aws_account_id  = var.aws_account_id
  aws_region      = var.aws_region
  lambda_zip_path = coalesce(var.aws_iot_lambda_zip_path != "" ? var.aws_iot_lambda_zip_path : null, abspath("${path.module}/../../../aws-iot-bridge/dist/aws-iot-bridge.zip"))

  pubsub_topic_name = "iot.telemetry.received"
  iot_thing_name    = var.aws_iot_thing_name
  iot_topic_prefix  = var.aws_iot_topic_prefix
  iot_topic_filter  = var.aws_iot_topic_filter

  depends_on = [
    google_project_service.required,
    module.managed_data
  ]
}
