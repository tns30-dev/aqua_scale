variable "cloud_armor_policy_name" {
  description = "Cloud Armor security policy name."
  type        = string
}

variable "rate_limit_requests_per_minute" {
  description = "Public API rate limit per source IP."
  type        = number
  default     = 120
}
