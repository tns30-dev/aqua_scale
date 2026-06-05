terraform {
  required_version = ">= 1.8.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  skip_credentials_validation = !var.enable_aws_iot_bridge
  skip_metadata_api_check     = !var.enable_aws_iot_bridge
  skip_requesting_account_id  = !var.enable_aws_iot_bridge
}
