# New Microservice GCP Project Bootstrap - 2026-08-08

## Scope

Create an isolated GCP project for the second-round microservice cloud-native
environment. Do not use `aquashield-staging`, because that project is reserved
for the monolith application.

## Result

| Check | Result |
|---|---|
| New project | `aquashield-ms-dev-20260808` created |
| Billing | Linked to the open billing account |
| Active gcloud default | Still `aquashield-staging`; not changed |
| ADC quota project | Set to `aquashield-ms-dev-20260808` for Terraform/GCS backend calls |
| Terraform state bucket | `aquashield-aquashield-ms-dev-20260808-tfstate` created |
| Dev Terraform backend | Reconfigured to the new state bucket |
| Terraform fmt | Pass |
| Terraform validate | Pass |
| AWS profile | `aquashield` verified with STS |
| AWS account | `157466815831` |
| Terraform plan | `210 to add, 0 to change, 0 to destroy` |
| Saved plan | `/private/tmp/aquashield-ms-dev-20260808-with-aws-iot.tfplan` |
| Terraform apply | Complete; GCP runtime and AWS IoT bridge created |

## Runtime Plan Summary

The applied plan creates the dev microservice foundation in the new project:

| Area | Planned |
|---|---|
| Required APIs | Artifact Registry, GKE, Compute, IAM, Pub/Sub, SQL Admin, Redis, Bigtable, BigQuery, Service Networking, STS |
| Network | VPC, subnet, pod/service secondary ranges, Cloud NAT, private service access, firewall rules |
| GKE | `aquashield-dev-gke` and `aquashield-dev-primary` node pool |
| Artifact Registry | One Docker repository per service |
| GitHub OIDC | GitHub deployer service account and Workload Identity provider |
| Managed data | Cloud SQL PostgreSQL, Memorystore Redis, Pub/Sub topics/subscriptions, Bigtable, BigQuery |
| Public edge | Global static IP and managed certificate for `api.aquashield.live` |
| AWS IoT bridge | IoT Thing, x.509 certificate, publish-only IoT policy, IoT Rule, Lambda bridge, CloudWatch log group, and GCP WIF publisher access |

AWS IoT bridge is enabled because live device telemetry enters the microservice
environment through AWS IoT Core and the Lambda-to-GCP Pub/Sub bridge.

## Terraform Apply Result

The apply created the GCP managed runtime resources successfully:

| Output | Value |
|---|---|
| GKE cluster | `aquashield-dev-gke` |
| Cloud SQL private IP | `10.199.0.3` |
| Cloud SQL connection name | `aquashield-ms-dev-20260808:asia-southeast1:aquashield-dev-postgres` |
| Cloud SQL database | `aquashield` |
| Memorystore Redis | `10.199.73.251:6379` |
| API edge IP | `34.54.25.36` |
| API edge domain | `api.aquashield.live` |
| Bigtable | `aquashield-dev-telemetry/telemetry_readings` |
| BigQuery | `aquashield_dev_analytics` |
| Pub/Sub telemetry topic | `iot.telemetry.received` |
| AWS bridge GCP service account | `aq-aws-iot-bridge-dev@aquashield-ms-dev-20260808.iam.gserviceaccount.com` |
| AWS bridge GCP WIF provider | `projects/652498179105/locations/global/workloadIdentityPools/aquashield-aws-dev/providers/aws-iot-bridge` |

Sensitive Terraform outputs, including Cloud SQL passwords and AWS IoT private
keys, were not printed into evidence.

The final AWS IoT bridge completion plan was applied successfully:

| Check | Result |
|---|---|
| Saved plan | `/private/tmp/aquashield-ms-dev-20260808-aws-iot-final-no-destroy.tfplan` |
| Terraform apply | `6 added, 0 changed, 0 destroyed` |
| Lambda function | `aquashield-dev-iot-bridge` |
| Lambda state/runtime | `Active`, `nodejs20.x` |
| Lambda role | `arn:aws:iam::157466815831:role/aquashield-dev-iot-bridge` |
| IoT Thing | `aq-dev-simulator-01` |
| IoT Rule | `aquashield_dev_iot_bridge` |
| IoT Rule disabled | `false` |
| MQTT filter | `aquashield/dev/telemetry/+` |
| CloudWatch log group | `/aws/lambda/aquashield-dev-iot-bridge` |
| Log retention | `14 days` |

Cluster credentials were fetched locally with:

```sh
gcloud container clusters get-credentials aquashield-dev-gke --zone asia-southeast1-a --project aquashield-ms-dev-20260808
```

`kubectl get nodes -o wide` returned one ready private node:

| Node | Status | Internal IP | External IP | Version |
|---|---|---|---|---|
| `gke-aquashield-dev-g-aquashield-dev-p-38c8e669-psjl` | `Ready` | `10.10.0.3` | `<none>` | `v1.35.6-gke.1250000` |

The AWS part of the apply stopped with `AccessDenied` for the local AWS IAM
user `arn:aws:iam::157466815831:user/aquashield`.

| Missing AWS permission | Resource Terraform tried to create |
|---|---|
| `logs:CreateLogGroup` | `/aws/lambda/aquashield-dev-iot-bridge` |
| `iam:CreateRole` | `arn:aws:iam::157466815831:role/aquashield-dev-iot-bridge` |
| `iot:CreateThing` | `arn:aws:iot:ap-southeast-1:157466815831:thing/aq-dev-simulator-01` |
| `iot:CreateKeysAndCertificate` | AWS IoT x.509 device certificate |
| `iot:CreatePolicy` | `aq-dev-simulator-01-telemetry-publish` |

Attach the policy in
`docs/second_evidence/cloud_native_environment/aws_iot_bridge_terraform_policy.json`
to the `aquashield` IAM user, then rerun Terraform apply. GCP resources are
already in state, so Terraform should only continue the unfinished AWS bridge
work plus any dependent resources.

Attempting to attach this inline policy with the same `aquashield` AWS profile
also failed:

| Command | Result |
|---|---|
| `aws iam put-user-policy --user-name aquashield --policy-name AquaShieldMsDevTerraformAwsIotBridge --policy-document file://docs/second_evidence/cloud_native_environment/aws_iot_bridge_terraform_policy.json --profile aquashield` | `AccessDenied`; missing `iam:PutUserPolicy` |

Therefore the permission fix must be done from an AWS root/admin identity, not
from the current `aquashield` IAM user.

After the policy was created in AWS Console, Terraform was retried with a fresh
plan:

| Check | Result |
|---|---|
| Fresh plan after AWS policy creation | `11 to add, 0 to change, 0 to destroy` |
| Saved plan | `/private/tmp/aquashield-ms-dev-20260808-after-aws-policy.tfplan` |
| Apply retry | Failed with the same `AccessDenied` errors |

The retry still denied `logs:CreateLogGroup`, `iam:CreateRole`,
`iot:CreateThing`, `iot:CreateKeysAndCertificate`, and `iot:CreatePolicy`.
That means the created policy was not yet effective for the `aquashield` IAM
user. The most likely cause is that the customer managed policy was created but
not attached to `IAM > Users > aquashield > Permissions`, or an AWS permissions
boundary/SCP is blocking those actions.

After attaching/updating the policy, Terraform progressed further: AWS created
the IoT certificate, but failed on Terraform provider read-back permissions:

| Missing AWS permission | Why Terraform needs it |
|---|---|
| `logs:DescribeLogGroups` on `*` | Read the CloudWatch log group after create |
| `iam:ListAttachedRolePolicies` | Read the Lambda execution role after create |
| `iam:ListInstanceProfilesForRole` | Read the Lambda execution role after create |
| `iot:DescribeThing` | Read the IoT Thing after create |
| `iot:ListTagsForResource` | Read IoT policy tags after create |

The policy file has been consolidated into one compact JSON document that
includes both create/update actions and Terraform read-back permissions.

After consolidating the repo policy to one file, Terraform was retried again.
The AWS provider can now refresh the CloudWatch log group, IAM role, IoT
certificate, IoT policy, and IoT thing in state, but AWS still denies IoT
read-back permissions:

| Missing AWS permission still denied | Resource |
|---|---|
| `iot:DescribeThing` | `arn:aws:iot:ap-southeast-1:157466815831:thing/aq-dev-simulator-01` |
| `iot:ListTagsForResource` | `arn:aws:iot:ap-southeast-1:157466815831:policy/aq-dev-simulator-01-telemetry-publish` |

This means the attached AWS policy has not yet been updated to the single
current repo policy, which grants `iot:*` on `Resource: "*"`, or an AWS
permissions boundary is blocking IoT read actions. Terraform had also marked
the CloudWatch log group and IAM role tainted after the previous failed apply;
both were untainted because they exist with the intended names and settings.

## Kubernetes Prep

Added `k8s/overlays/performance-managed-public` for final cloud-native
performance evidence against the managed GCP runtime and public API edge.

The overlay renders successfully and now points workload identity annotations
at `aquashield-ms-dev-20260808`. The managed runtime private IP values have
been synced from Terraform outputs:

| Field | Value |
|---|---|
| `CLOUD_SQL_PRIVATE_IP` | `10.199.0.3` |
| `MEMORYSTORE_REDIS_HOST` | `10.199.73.251` |
| `REDIS_URL` | `redis://10.199.73.251:6379` |

## Verification

| Check | Result |
|---|---|
| `terraform fmt -check -recursive infra` | Pass |
| `terraform -chdir=infra/environments/dev validate` | Pass |
| `kubectl kustomize k8s/overlays/performance-managed-public` | Pass |
| `jq empty docs/second_evidence/cloud_native_environment/aws_iot_bridge_terraform_policy.json` | Pass |
| `git diff --check` | Pass |

## Workload Rollout

The GKE workload rollout is recorded separately in
`docs/second_evidence/cloud_native_environment/2026-08-08-gke-workload-rollout.md`.

| Check | Result |
|---|---|
| Service images | Nine images pushed to Artifact Registry tag `20260808-1440-6fbd5a1c8557` |
| Kubernetes apply | Pass |
| Cloud SQL bootstrap | Complete |
| Deployments | `10/10` ready |
| Gateway | Programmed on `34.54.25.36` |
| Smoke | API edge health, admin login, and cross-service JWT check passed |

## Next Step

Update DNS for `api.aquashield.live` to `34.54.25.36`, wait for the managed
certificate to become `ACTIVE`, then run cloud-native k6 evidence.
