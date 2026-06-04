resource "google_compute_network" "this" {
  project                 = var.project_id
  name                    = var.network_name
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "gke" {
  project                  = var.project_id
  name                     = var.subnet_name
  region                   = var.region
  network                  = google_compute_network.this.id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = var.enable_private_google_access

  secondary_ip_range {
    range_name    = var.pod_secondary_name
    ip_cidr_range = var.pod_secondary_cidr
  }

  secondary_ip_range {
    range_name    = var.service_secondary_name
    ip_cidr_range = var.service_secondary_cidr
  }
}

resource "google_compute_router" "this" {
  count = var.enable_cloud_nat ? 1 : 0

  project = var.project_id
  name    = "${var.network_name}-router"
  region  = var.region
  network = google_compute_network.this.id
}

resource "google_compute_router_nat" "this" {
  count = var.enable_cloud_nat ? 1 : 0

  project                            = var.project_id
  name                               = "${var.network_name}-nat"
  router                             = google_compute_router.this[0].name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.gke.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
}

resource "google_compute_firewall" "allow_gclb_health_checks" {
  project = var.project_id
  name    = "${var.network_name}-allow-gclb-health-checks"
  network = google_compute_network.this.name

  direction     = "INGRESS"
  priority      = 1000
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = [var.gke_node_network_tag]

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]
  }
}

resource "google_compute_firewall" "allow_internal" {
  project = var.project_id
  name    = "${var.network_name}-allow-internal"
  network = google_compute_network.this.name

  direction     = "INGRESS"
  priority      = 1100
  source_ranges = [var.subnet_cidr, var.pod_secondary_cidr, var.service_secondary_cidr]
  target_tags   = [var.gke_node_network_tag]

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }
}
