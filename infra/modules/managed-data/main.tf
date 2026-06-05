locals {
  cloud_sql_users = {
    identity_access = "identity_access_svc"
    project         = "project_svc"
    pond            = "pond_svc"
    sensor          = "sensor_svc"
    ingestion       = "ingestion_svc"
    notification    = "notification_svc"
    audit           = "audit_svc"
  }

  pubsub_catalogue = {
    "iot.telemetry.received"   = ["ingestion"]
    "sensor.message.validated" = ["audit"]
    "sensor.message.rejected"  = ["audit"]
    "reading.ingested"         = ["notification", "realtime", "audit"]
    "reading.quarantined"      = ["audit"]
    "threshold.violated"       = ["realtime", "audit"]
    "alert.created"            = ["realtime", "audit"]
    "alert.resolved"           = ["realtime", "audit"]
    "notification.requested"   = ["dispatcher"]
    "notification.sent"        = ["audit"]
    "audit.event.recorded"     = ["audit"]
    "project.created"          = ["audit"]
    "project.updated"          = ["audit"]
    "project.settings.updated" = ["notification", "audit"]
    "device.registered"        = ["audit"]
    "device.status.changed"    = ["realtime", "audit"]
    "project.sensor.assigned"  = ["ingestion", "audit"]
    "project.sensor.updated"   = ["ingestion", "audit"]
  }

  pubsub_topic_names = toset(concat(
    keys(local.pubsub_catalogue),
    [for topic in keys(local.pubsub_catalogue) : "${topic}.dlq"]
  ))

  pubsub_subscriptions = flatten([
    for topic, subscribers in local.pubsub_catalogue : concat(
      [
        for subscriber in subscribers : {
          name              = "${subscriber}.${topic}.sub"
          topic             = topic
          dead_letter_topic = "${topic}.dlq"
        }
      ],
      [
        {
          name              = "dlq-inspect.${topic}.sub"
          topic             = "${topic}.dlq"
          dead_letter_topic = null
        }
      ]
    )
  ])

  pubsub_subscriptions_by_name = {
    for subscription in local.pubsub_subscriptions : subscription.name => subscription
  }

  runtime_service_accounts = {
    identity = {
      account_id = "aq-identity-dev"
      ksa_name   = "identity-access-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.publisher"]
    }
    project = {
      account_id = "aq-project-dev"
      ksa_name   = "project-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.publisher"]
    }
    pond = {
      account_id = "aq-pond-dev"
      ksa_name   = "pond-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.publisher"]
    }
    sensor = {
      account_id = "aq-sensor-dev"
      ksa_name   = "sensor-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.publisher"]
    }
    ingestion = {
      account_id = "aq-ingestion-dev"
      ksa_name   = "ingestion-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.publisher", "roles/pubsub.subscriber", "roles/bigtable.user"]
    }
    notification = {
      account_id = "aq-notification-dev"
      ksa_name   = "notification-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.publisher", "roles/pubsub.subscriber"]
    }
    realtime = {
      account_id = "aq-realtime-dev"
      ksa_name   = "realtime-gateway"
      roles      = ["roles/pubsub.subscriber"]
    }
    analytics = {
      account_id = "aq-analytics-dev"
      ksa_name   = "analytics-service"
      roles      = ["roles/bigtable.reader", "roles/bigquery.jobUser"]
    }
    audit = {
      account_id = "aq-audit-dev"
      ksa_name   = "audit-service"
      roles      = ["roles/cloudsql.client", "roles/pubsub.subscriber"]
    }
  }

  runtime_service_account_roles = flatten([
    for service_key, service_account in local.runtime_service_accounts : [
      for role in service_account.roles : {
        key         = "${service_key}:${role}"
        service_key = service_key
        role        = role
      }
    ]
  ])
}

resource "random_password" "postgres_admin" {
  count = var.enable_cloud_sql ? 1 : 0

  length           = 32
  special          = true
  override_special = "_-"
}

resource "random_password" "postgres_service_user" {
  for_each = var.enable_cloud_sql ? local.cloud_sql_users : {}

  length           = 32
  special          = true
  override_special = "_-"
}

resource "google_sql_database_instance" "postgres" {
  count = var.enable_cloud_sql ? 1 : 0

  project             = var.project_id
  name                = var.cloud_sql_instance_name
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = var.cloud_sql_deletion_protection

  settings {
    tier              = var.cloud_sql_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = var.cloud_sql_disk_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "17:00"
      transaction_log_retention_days = 1
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_self_link
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }
  }
}

resource "google_sql_database" "aquashield" {
  count = var.enable_cloud_sql ? 1 : 0

  project  = var.project_id
  name     = var.cloud_sql_database_name
  instance = google_sql_database_instance.postgres[0].name
}

resource "google_sql_user" "postgres_admin" {
  count = var.enable_cloud_sql ? 1 : 0

  project  = var.project_id
  name     = "postgres"
  instance = google_sql_database_instance.postgres[0].name
  password = random_password.postgres_admin[0].result
}

resource "google_sql_user" "service_user" {
  for_each = var.enable_cloud_sql ? local.cloud_sql_users : {}

  project  = var.project_id
  name     = each.value
  instance = google_sql_database_instance.postgres[0].name
  password = random_password.postgres_service_user[each.key].result
}

resource "google_redis_instance" "redis" {
  count = var.enable_memorystore ? 1 : 0

  project        = var.project_id
  name           = var.redis_instance_name
  display_name   = "AquaShield dev Redis"
  region         = var.region
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_size_gb

  authorized_network      = var.network_self_link
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  redis_version           = "REDIS_7_0"
  transit_encryption_mode = "DISABLED"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}

resource "google_pubsub_topic" "topic" {
  for_each = var.enable_pubsub ? local.pubsub_topic_names : []

  project = var.project_id
  name    = each.key

  message_retention_duration = "604800s"
}

resource "google_project_iam_member" "pubsub_service_agent" {
  for_each = var.enable_pubsub ? toset(["roles/pubsub.publisher", "roles/pubsub.subscriber"]) : []

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:service-${var.project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "subscription" {
  for_each = var.enable_pubsub ? local.pubsub_subscriptions_by_name : {}

  project = var.project_id
  name    = each.key
  topic   = google_pubsub_topic.topic[each.value.topic].id

  ack_deadline_seconds       = 30
  message_retention_duration = "604800s"

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dynamic "dead_letter_policy" {
    for_each = each.value.dead_letter_topic == null ? [] : [each.value.dead_letter_topic]

    content {
      dead_letter_topic     = google_pubsub_topic.topic[dead_letter_policy.value].id
      max_delivery_attempts = 5
    }
  }

  depends_on = [google_project_iam_member.pubsub_service_agent]
}

resource "google_bigtable_instance" "telemetry" {
  count = var.enable_bigtable ? 1 : 0

  project             = var.project_id
  name                = var.bigtable_instance_name
  display_name        = "AquaShield dev telemetry"
  deletion_protection = var.bigtable_deletion_protection

  cluster {
    cluster_id   = var.bigtable_cluster_id
    zone         = var.bigtable_zone
    num_nodes    = var.bigtable_num_nodes
    storage_type = "SSD"
  }
}

resource "google_bigtable_table" "telemetry_readings" {
  count = var.enable_bigtable ? 1 : 0

  project       = var.project_id
  instance_name = google_bigtable_instance.telemetry[0].name
  name          = "telemetry_readings"

  column_family {
    family = "raw"
  }

  column_family {
    family = "parsed"
  }

  column_family {
    family = "meta"
  }
}

resource "google_bigquery_dataset" "analytics" {
  count = var.enable_bigquery ? 1 : 0

  project                    = var.project_id
  dataset_id                 = var.bigquery_dataset_id
  friendly_name              = "AquaShield dev analytics"
  description                = "Bounded analytics dataset for AquaShield microservices migration evidence."
  location                   = var.bigquery_location
  delete_contents_on_destroy = true

  default_table_expiration_ms = 1000 * 60 * 60 * 24 * 90

  labels = {
    app         = "aquashield"
    environment = "dev"
  }
}

resource "google_bigquery_table" "readings" {
  count = var.enable_bigquery ? 1 : 0

  project    = var.project_id
  dataset_id = google_bigquery_dataset.analytics[0].dataset_id
  table_id   = "readings"

  deletion_protection = false

  time_partitioning {
    type          = "DAY"
    field         = "event_ts"
    expiration_ms = 1000 * 60 * 60 * 24 * 90
  }

  clustering = ["project_id", "pond_id", "parameter_key"]

  schema = jsonencode([
    { name = "event_ts", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "project_id", type = "STRING", mode = "REQUIRED" },
    { name = "pond_id", type = "STRING", mode = "REQUIRED" },
    { name = "device_id", type = "STRING", mode = "REQUIRED" },
    { name = "parameter_key", type = "STRING", mode = "REQUIRED" },
    { name = "numeric_value", type = "FLOAT", mode = "NULLABLE" },
    { name = "quality", type = "STRING", mode = "NULLABLE" },
    { name = "correlation_id", type = "STRING", mode = "NULLABLE" },
    { name = "ingested_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

resource "google_bigquery_table" "alerts" {
  count = var.enable_bigquery ? 1 : 0

  project    = var.project_id
  dataset_id = google_bigquery_dataset.analytics[0].dataset_id
  table_id   = "alerts"

  deletion_protection = false

  time_partitioning {
    type          = "DAY"
    field         = "event_ts"
    expiration_ms = 1000 * 60 * 60 * 24 * 90
  }

  clustering = ["project_id", "pond_id", "severity"]

  schema = jsonencode([
    { name = "event_ts", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "project_id", type = "STRING", mode = "REQUIRED" },
    { name = "pond_id", type = "STRING", mode = "NULLABLE" },
    { name = "alert_id", type = "STRING", mode = "REQUIRED" },
    { name = "severity", type = "STRING", mode = "REQUIRED" },
    { name = "status", type = "STRING", mode = "REQUIRED" },
    { name = "rule_key", type = "STRING", mode = "NULLABLE" },
    { name = "correlation_id", type = "STRING", mode = "NULLABLE" }
  ])
}

resource "google_service_account" "runtime" {
  for_each = local.runtime_service_accounts

  project      = var.project_id
  account_id   = each.value.account_id
  display_name = "AquaShield dev ${each.key} runtime"
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = {
    for binding in local.runtime_service_account_roles : binding.key => binding
  }

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.runtime[each.value.service_key].email}"
}

resource "google_service_account_iam_member" "workload_identity_user" {
  for_each = local.runtime_service_accounts

  service_account_id = google_service_account.runtime[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.kubernetes_namespace}/${each.value.ksa_name}]"
}

resource "google_bigquery_dataset_iam_member" "analytics_reader" {
  count = var.enable_bigquery ? 1 : 0

  project    = var.project_id
  dataset_id = google_bigquery_dataset.analytics[0].dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.runtime["analytics"].email}"
}
