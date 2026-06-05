# Speaker Note - CI/CD and Cloud Deployment Demonstration

## Opening

In this section, I will demonstrate the DevSecOps and cloud deployment side of AquaShield. The goal is to show that the platform is not only built as application code, but also delivered using a professional cloud-native pipeline.

The pipeline covers continuous integration, security scanning, container image release, GitOps handoff, and runtime deployment evidence. This makes each change traceable from GitHub source code to the running services in the cloud environment.

## Backend CI - All Changed Services

First, I will show the backend service CI workflow. This workflow is responsible for building, testing, and validating the backend services.

In the all-service run, the pipeline selected the changed backend services and executed the build and test jobs across the service matrix. The workflow also ran shared security gates, including secret scanning with Gitleaks, static security scanning with Semgrep, dependency and filesystem scanning with Trivy, and software bill of materials generation with CycloneDX.

This is important because the backend is not treated as one single build unit. Each service can be validated independently, while shared security controls are still applied across the repository.

The CI evidence output shows that the build, tests, container checks, and security jobs completed successfully. This gives a clear evidence point for code quality and delivery readiness.

## Backend CI - Single-Service Change

Next, I will show the single-service CI run. This is used to demonstrate the path-aware behavior of the pipeline.

When only one backend service changes, the pipeline does not need to rebuild and retest every service. It detects the affected service, runs the required build and test job for that service, and skips unrelated service jobs where appropriate.

This design is important for microservice delivery because it keeps feedback fast while still preserving security checks and CI evidence. It shows that the platform pipeline can scale as the number of services grows.

## CI Security Gates

The CI workflow also includes security gates before deployment.

Gitleaks checks that credentials or secrets are not committed into the repository. Semgrep checks risky source-code patterns. Trivy checks dependency and filesystem risks. CycloneDX produces an SBOM, which gives supply-chain visibility for the software components used by the platform.

These checks make the CI process more than a basic build. It becomes a DevSecOps pipeline where quality and security are validated before release.

## Container Release and Artifact Registry

After CI passes, the release workflow builds service container images. Each image is scanned before being pushed.

The images are stored in Google Artifact Registry. The repositories are separated by service, which makes the image ownership clear. The image tags are Git-SHA based, so the deployed image can be traced back to a specific source-code commit.

This is important for rollback, audit, and deployment traceability. If a service is running in the cluster, we can identify exactly which version of the code produced that image.

## GitOps Handoff and Argo CD

After the image is pushed, the deployment manifest is updated through the GitOps handoff. The image tag in the Kubernetes manifests is changed using the approved Git-SHA image version.

Argo CD then reconciles the runtime environment with the desired state stored in Git. This means the cluster deployment is not manually changed from a developer machine. Instead, the Git repository remains the source of truth for what should be running.

This approach gives better control, visibility, and repeatability for deployment.

## Runtime Evidence in GKE

Next, I will show the GKE runtime evidence. The GKE workloads page shows that the AquaShield services are running as Kubernetes deployments.

The services include identity and access, project, pond, sensor, ingestion, notification, realtime gateway, analytics, audit, and the API edge proxy. The status is healthy, and each service is running in the application namespace.

The GKE cluster overview also shows that the cluster itself is healthy, with the node capacity available for the runtime environment.

This proves that the services are not only built, but actually deployed and running in the cloud.

## Public API Edge and Runtime Configuration

The public API gateway evidence shows how external traffic enters the platform. Public HTTPS traffic goes through the API edge, while the backend services remain inside the Kubernetes runtime.

The ConfigMaps and Secrets evidence shows that runtime configuration is managed through Kubernetes resources. This separates configuration and secrets from application code, which is a standard practice for cloud-native deployment.

## Managed Messaging and Data Stores

AquaShield also uses managed cloud services for messaging and data storage.

Pub/Sub topics support event-driven communication, including telemetry events, alerts, notifications, project events, and dead-letter topics. This supports asynchronous processing between services.

Bigtable is used for telemetry-style sensor readings, where high-volume time-series data can be stored efficiently. BigQuery is used for analytics tables, such as alert analytics and reporting queries.

These managed services support the platform requirement to process realtime telemetry, retain history, and produce analytics evidence.

## AWS IoT and Lambda Bridge

The AWS IoT evidence shows the IoT ingestion side. AWS IoT Core receives MQTT telemetry from IoT devices. An IoT rule triggers the Lambda bridge, and the Lambda bridge forwards the telemetry into the Google Pub/Sub ingestion path.

This demonstrates cross-cloud integration for device telemetry. The device side enters through AWS IoT, while the application and analytics side continues through the Google Cloud platform.

## Closing

To summarize the CI/CD and deployment demonstration, AquaShield uses a complete cloud-native delivery flow.

Source code changes are validated by CI, checked by security gates, packaged into container images, pushed to Artifact Registry, handed off through GitOps manifests, and reconciled into GKE by Argo CD.

The runtime evidence shows the platform services running in GKE, the public API edge configured, managed messaging and data stores available, and IoT telemetry connected through AWS IoT and Lambda. This gives the project professional delivery evidence from source code to running cloud infrastructure.
