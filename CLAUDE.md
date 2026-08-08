# AQ_Cook — AquaShield: Monolith → Cloud-Native Microservices

> **Mission:** Rebuild **AquaShield** (aquaculture monitoring; current monolith in
> `AquaMonitoringv2/`) as **cloud-native microservices**: GCP-primary (GKE) with an AWS IoT
> boundary, Java/Spring Boot services, event-driven core, full DevSecOps — for the SE33
> capstone. ML/LLM are *future add-on placeholders*, not first-pass scope.

Loaded every session — kept lean. Depth lives in **skills**, in **`cooking_tracker/main/`**
(the decided implementation specs), and **`cooking_tracker/background_context/`** (grading
& system context).

---

## 🔄 MANDATORY: tracker sync protocol (read every session)

My work is scoped by **`cooking_tracker/claude/checklist.md`** (subset of
`cooking_tracker/main/checklist.md`; Codex owns the rest). **Codex relies on my trackers to
know my progress — keeping them current is part of every task, not an afterthought.**

After ANY implementation progress, update the matching tracker in `cooking_tracker/claude/`:

| Tracker | Covers |
|---------|--------|
| `services_tracker.md` | The 9 services + ML/LLM placeholders |
| `data_and_messaging_tracker.md` | Cloud SQL, Redis, Bigtable, BigQuery, GCS, Pub/Sub, AWS IoT, Terraform |
| `security_tracker.md` | Authn/authz, snapshots, token lifecycle, firewall layers, mTLS, scan evidence |
| `ci_cd_and_testing_tracker.md` | CI workflows, registry, GitOps, Argo CD, smoke/DAST/k6 performance, evidence |

Each update: set item status, add a dated log line, fill "Summary for Codex"
(current focus / last completed / blockers), link evidence. Tick `claude/checklist.md`
when an item is fully done. Use **`/sync-tracker`** to do this consistently.

## 📌 Decided architecture (do NOT relitigate — specs in `cooking_tracker/main/`)

- **Cloud:** GCP primary — GKE (custom VPC, VPC-native, private nodes), Cloud SQL PostgreSQL
  (+ read replica), Memorystore Redis, **Bigtable** (telemetry, cost-bounded), **BigQuery**
  (analytics, cost-bounded), Pub/Sub, Cloud Storage, Artifact Registry, Cloud Armor,
  External HTTPS LB + GKE Gateway/Ingress. Frontend on **Firebase Hosting**.
- **IoT boundary: AWS** — IoT Core (MQTT/TLS, X.509 device certs, topic-scoped policies) →
  IoT Rule → **TypeScript Lambda bridge** → (Workload Identity Federation, `pubsub.publisher`
  only) → GCP Pub/Sub `iot.telemetry.received`.
- **Services (one folder per service at repo root; Maven multi-module):** Java 21 + Spring
  Boot: `identity-access`, `project`, `pond`, `sensor`, `ingestion`, `notification`, `audit`;
  **Java WebFlux**: `realtime-gateway`; **TypeScript/Express**: `analytics`.
  ML/LLM = Python/FastAPI **placeholders only**.
- **APIs:** REST/JSON externally via gateway; **gRPC** service-to-service; events via Pub/Sub
  (JSON envelope, versioned schemas, DLQ per important subscription, idempotent consumers).
- **Auth model:** short-lived JWT (compact; carries authz **version**, not the matrix) +
  opaque rotating refresh tokens + **Redis authorization snapshot** (`authz:snapshot:{userId}:{version}`)
  as the hot path; Identity gRPC = fallback only; fail closed. WebSocket: `/ws/token` mint →
  WSS → first-frame AUTH → Redis `jti` replay protection.
- **Mesh & network:** Istio-compatible Cloud Service Mesh (strict mTLS, AuthorizationPolicy),
  Kubernetes NetworkPolicy (default-deny), three-layer firewall model (edge→app→data).
- **Delivery:** path-aware monorepo CI (GitHub Actions, OIDC/WIF — no long-lived keys) →
  Artifact Registry → **Kustomize** image-tag bump → **Argo CD** sync to GKE namespaces
  (`aquashield-dev` auto, staging manual). k6 cloud-native performance evidence via
  Kubernetes Job or GitHub Actions manual/performance-test runs. OWASP ZAP post-deploy.
  **Terraform** with GCS remote state (`infra/`).
- **Monolith parity rule:** before implementing any service, read the matching Django
  `module_*` code and preserve its business semantics (esp. `module_user` authorization,
  chart contract `GET /api/projects/{id}/charts/`).

## Monorepo layout (FLAT — one service per repo-root folder, ChronoFlow style)

```
identity-access-service/  project-service/  pond-service/  sensor-service/
ingestion-service/  notification-service/  realtime-gateway/  analytics-service/
audit-service/  ml-service/  llm-service/          ← service roots
common/ (shared Java lib)   shared-api/{proto,events}/   k8s/{base,overlays}/
infra/ (terraform)   loadtests/   scripts/  local/  docs/evidence/  .github/workflows/
pom.xml  ← Maven multi-module parent (Java 21, Boot 3.4.x); modules enabled as built
```
Everything lives in THIS repo (`tns30-dev/aqua_scale`); `cooking_tracker/` is deleted
before submission. No separate implementation repo.

## Roles

| Actor | Role | Scope |
|-------|------|-------|
| **User (senior)** | Decision-maker; ask him questions & cloud credentials freely | Final calls |
| **Claude (me)** | Builder | Data & messaging, security impl, all 9 services, CI/CD & testing (`claude/checklist.md`) |
| **Codex** | Partner/assessor | Architecture & contracts docs, cloud foundation (VPC/GKE/mesh), edge & frontend (`codex/checklist.md`) |

## Source-of-truth reading order (before designing/implementing X)

1. `cooking_tracker/claude/checklist.md` — is X mine? what's the expected output?
2. `cooking_tracker/main/<X>.md` — the decided spec/checklist for X (33 docs: per-service,
   per-store, per-pipeline; each has Target / Checklists / Evidence / Considerations).
3. `AquaMonitoringv2/backend/module_*` — current behavior to preserve.
4. `cooking_tracker/background_context/` — grading (`requirement.md`), current system
   (`aquashield.md`), security (`security.md`), target rationale (`archi_scale.md`).

## Skills (load on demand — `.claude/skills/README.md`)

| Skill | Use when… |
|-------|-----------|
| `java-spring-microservice` | Implementing/scaffolding any Java service (Boot, WebFlux, gRPC, tests) |
| `microservices-decomposition` | Service boundaries, contracts, monolith-parity extraction |
| `gcp-data-stores` | Cloud SQL, Redis keys/authz snapshot, Bigtable row keys, BigQuery cost control |
| `pubsub-eventing` | Topics, envelope, schemas, DLQ, idempotency, outbox, replay |
| `iot-aws-bridge` | AWS IoT Core, device certs, IoT Rules, TS Lambda → WIF → Pub/Sub |
| `cloud-native-k8s` | GKE, Kustomize, Argo CD, mesh, NetworkPolicy, gateway, probes/HPA |
| `devsecops-pipeline` | Path-aware CI, scans, SBOM, OIDC/WIF, GitOps handoff, k6, ZAP |
| `architecture-docs` | ADRs, diagrams, Codex hand-off, rubric mapping |
| `mlops-lifecycle` / `llmops-agentic` / `ml-llm-secops` | DORMANT — future add-ons only |

Agents: `system-design-reviewer` (pre-Codex design check) · `monolith-parity-checker`
(extracts Django business rules for a service). Commands: `/sync-tracker` · `/adr` · `/handoff-codex`.

## Git & repo safety rules

- **Repo:** ONE repo — `AQ_Cook` → `tns30-dev/aqua_scale` (private) holds planning AND
  implementation (flat layout). `AquaMonitoringv2/` and `AquaMonitoring-Pi/` point to
  **AquaShield-Solutions/** (inherited upstream) — **NEVER push to those remotes**;
  pull/read only; both git-ignored here.
- **Authorship:** commits/pushes are authored as the user (tns30-dev) — **no Claude
  Co-Authored-By trailers, ever.**

## Working conventions

- **Tracker first-class:** no completed work without a tracker update (see protocol above).
- **Evidence rule:** every claim → artifact (CI run, screenshot, test result, manifest) in `docs/evidence/`.
- **Spec-driven:** implement to `main/<X>.md` checklists; tick items there mentally, track in my trackers.
- **Cost control:** Bigtable/BigQuery bounded (emulator/local first; `maximum_bytes_billed`); no expensive replication.
- **Security:** fail closed on Redis/authz failures; TTL on every Redis key; no raw secrets in code/state; least-privilege IAM.
- **Ask the user** for cloud credentials (gcloud/AWS), GCP project choice, and anything blocking — he's the senior and welcomes questions.
- **Verify before claiming done.** If skipped/failed, say so plainly.
