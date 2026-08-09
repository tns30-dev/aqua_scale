# 04 Technical Assessment - DevSecOps

Rubric: Assessment Rubrics III, DevSecOps
Duration: 10 minutes
Cloud dependency: Medium

## What This Video Must Prove

- The project has a real DevSecOps process, not only deployment scripts.
- CI, CD, security scanning, container management, performance testing, and compliance evidence are connected.
- Vulnerabilities were detected, fixed, and rescanned.
- Infrastructure is managed as code and backed by audit trails.

## Required Rubric Points

- CI/CD
  - Pipelines and tools used.
  - Unit testing result artifacts.
  - Integration testing result artifacts.
  - Load and stress testing result artifacts.
  - SAST tool and result artifacts.
  - DAST tool and result artifacts.
- Container Management
  - Building and saving images.
  - Image security with Trivy.
  - Interacting with and inspecting containers.
  - Container logs.
- Vulnerability Assessment
  - SAST resolution and rescan results.
  - DAST resolution and rescan results.
- Compliance as Code
  - Infrastructure-as-Code tools and artifacts.
  - Version control audit trails.
- Specific regulatory framework
  - Recommended framing: SOC 2 plus privacy/security mapping relevant to aquaculture telemetry and user data.

## Current Implementation Points

- CI runs on `main`, `dev`, and `test`.
- CD runs after CI success on `main`.
- Load and stress testing runs only on the `load-test` branch.
- Manual CI can run all workloads for full evidence screenshots.
- Automatic CI uses changed-workload selection to avoid unnecessary rebuilds.
- k6 cloud-native performance evidence is generated against `https://api.aquashield.live`.
- DAST uses OWASP ZAP against the deployed API.
- Trivy scans images and filesystem dependencies.
- Gitleaks checks secret exposure.
- SBOM is generated for dependency visibility.

## Suggested Speaker Notes

- Start with the pipeline split: CI validates quality, CD deploys after CI success, and load testing is isolated to a dedicated branch.
- Show the CI graph first because it is the clearest evidence of testing and scanning.
- Explain that container images are built, scanned, pushed to Artifact Registry, then deployed through Kubernetes/GitOps flow.
- Mention the vulnerability example: analytics image had a critical base/global npm package issue, it was fixed and rescanned.
- Explain compliance as code: Terraform, Kubernetes manifests, GitHub workflow history, Git commits, and repeatable evidence artifacts.

## Evidence To Capture

- GitHub Actions CI run graph on `main`.
- GitHub Actions CD run after CI success on `main`.
- GitHub Actions performance run on `load-test`.
- GitHub Actions artifacts for tests, scans, SBOM, DAST, and k6.
- Artifact Registry images and tags.
- Trivy scan results.
- ZAP DAST result summary.
- Container logs from GKE.
- Argo CD application health/sync.
- Terraform files and stateful resource evidence.
- Git commit history for audit trail.

## Open Items

- Add final links/run IDs for CI, CD, DAST, and load testing.
- Add final vulnerability fix/rescan summary.
- Add final compliance mapping table.
