# AquaShield v2 — Presentation Outline

Source: the consultant's proposed presentation template (screenshot 2026-05-20).

Time budget per item is the consultant's target; "1 min" items can flex up to 90s when paired with a diagram. The 17 numbered items below form the main flow; the Alternative MVP video + closing 4 items wrap the talk.

---

## Main flow

All items below are tracked but **only partially done** unless explicitly marked otherwise. The current focus is **step 13**.

| # | Topic | Time | Status |
|---|---|---|---|
| 1 | Project overview and introduction | 1 min | partial |
| 2 | Overall scope using a use case diagram | 1 min | partial |
| 3 | Project roadmap & key milestones | 1 min | partial |
| 4 | Complete project backlog of the project | — | partial |
| 5 | Overall SPRINT effort to date (estimate vs actual per member, all sprints) | — | partial |
| 6 | Tech Stack | — | partial |
| 7 | Architectural constraints and decisions | 1 min | partial |
| 8 | Diagrams — Physical & Logical architecture | 1 min | partial |
| 9 | Deployment diagram | 1 min | partial |
| 10 | Microservices architecture (highlighted / explained using Domain Driven Design) | 2 min | partial |
| 11 | Software design (use case, analysis → design transition) | 1 min | partial |
| 12 | Relational DB ER design + NoSQL schema design & collection objects | 1 min | partial |
| **13** | **CICD pipeline and CI/CD diagram — SAST, DAST, Unit Testing, Load and stress testing pipeline** | **1 min** | **🟡 FOCUS — workflows + load tests landed; diagram + verification pending (see `13.md`)** |
| 14 | Artifacts of Unit Testing, Integration Testing, End-to-end testing, stress testing | 1 min | not started — depends on 13 |
| 15 | Security — Front-end, backend, communication | 1 min | partial |
| 16 | Infrastructure-as-Code (IaC) | 1 min | 🟢 done for GCP demo via Terraform — see `16.md` |
| 17 | Live demo of the working app + CI/CD demo | 3–6 min | not started — depends on 13 |

*Alternative to 17:* MVP video of working app + CI/CD demo (3–6 min).

## Closing items

| # | Topic | Time |
|---|---|---|
| C1 | Management concerns, issues and mitigations | 2 min |
| C2 | Technical concerns, issues and mitigations | 2 min |
| C3 | Security concerns, mitigations and solutions | 2 min |
| C4 | AOB | — |

---

## Step 13 — CI/CD Pipeline (current focus)

**Goal:** make prod's CI/CD diagram and the underlying GitHub Actions workflow real. Today prod has **CD only** (`.github/workflows/deploy-backend.yml`, `deploy-frontend.yml`). We need to add the **CI half** covering:

| Stage | Tool | What it checks |
|---|---|---|
| **Lint** | ruff (BE), eslint (FE) | code style, obvious bugs |
| **Unit Testing** | pytest (BE), vitest (FE) | backend + frontend unit/integration tests |
| **E2E Testing** | Playwright | 4 user-mgmt e2e scenarios |
| **SAST — Static Application Security Testing** | bandit (BE Python), eslint-plugin-security or `npm audit` (FE) | static security analysis of source code |
| **DAST — Dynamic Application Security Testing** | OWASP ZAP baseline scan | active security probing against a running app |
| **Load + Stress Testing** | k6 | request throughput under load; behaviour at saturation |

**Deliverables for step 13:**

1. A new workflow `.github/workflows/ci.yml` that runs on every push / PR and orchestrates the stages above.
2. A `presentation/cicd_diagram.md` (Mermaid) showing the pipeline graphically — render-friendly in GitHub and in slides.
3. Updated CI step inputs:
   - `backend/requirements.txt` / equivalent gains `bandit` + `pytest-cov`.
   - `frontend/package.json` gets `npm audit` invocation; lint already exists.
   - A `loadtest/` directory with a k6 script covering the user-mgmt happy paths (login → list → onboard).
4. Documentation note in the readme / DoD pointing at the new workflow.

**Working repo for step 13:** prod (`/Users/thetnaungsoe/Desktop/AquaMonitoringv2`). The user has explicitly said: no commits during execution. Land everything in working tree; user reviews and commits manually.

See section "Step 13 execution plan" below for the per-item checklist.

---

## Step 13 — Execution plan (checklist tracking)

### CI items (quality gates — run on every PR + push to test/dev)

| # | Done | Area | Step |
|---|---|---|---|
| 13.1 | [x] | k6 scripts (used by CI load + stress jobs) | `loadtest/frontend.js` + `loadtest/backend.js`, two scenarios each. |
| 13.2 | [x] | BE dev tooling (used by CI typecheck/sast/sca jobs) | `requirements-dev.txt` + `mypy/django-stubs/bandit/pip-audit`. Prod: 103/103 tests pass. |
| 13.3 | [x] | CI workflows | `ci-frontend.yml` (9 jobs) + `ci-backend.yml` (8 jobs). Triggers: PR to any + push to `test`/`dev`. |
| 13.4 | [x] | DAST job (inside CI) | OWASP ZAP baseline vs `vite preview` / Django dev server, on both CI workflows. |

### CD items (demo deployment — runs on push to `dev`, GCP)

| # | Done | Area | Step |
|---|---|---|---|
| 13.5 | [x] | Dockerfiles + nginx + settings | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `backend/config/settings/gcp.py`. |
| 13.6 | [x] | GCP deploy workflows | `deploy-gcp-backend.yml` + `deploy-gcp-frontend.yml`. Project `acceclaim-redemp-1777300214631`, region `asia-southeast1`. Inert until GH Secrets + one-time GCP setup (see `13.md` §5.6) land. |
| 13.7 | [ ] | One-time GCP setup (via Terraform — see step 16 / `16.md`) | `cd infra/terraform && terraform apply` provisions APIs + AR + Cloud SQL + Secret Manager + deploy SA. Then `gcloud sql import` seeds the DB and `terraform output deploy_sa_key` → GH secret `GCP_SA_KEY`. |

### Cross-cutting

| # | Done | Area | Step |
|---|---|---|---|
| 13.8  | [ ] | Diagram | `presentation/cicd_diagram.md` Mermaid showing CI lanes → branch policy → both CD tracks (mentor VM on `main`, GCP on `dev`). |
| 13.9  | [ ] | Verification | Push to `dev`: confirm CI workflows green, confirm GCP CD reaches Cloud Run, capture screenshots for the slide. |
| 13.10 | [ ] | DoD/README note | One paragraph in prod README explaining the two-track CI/CD. |

**Writeup:** see `presentation/13.md` for the full narrative.

**Scope call (2026-05-20):** demo deployment uses **GCP (Cloud Run + Artifact Registry + Cloud SQL Postgres 15)** on the `dev` branch. Mentor's existing `deploy-{backend,frontend}.yml` and VM deploy stay untouched on `main`. MQTT / live ingestion is out of scope for the demo — Cloud Run backend runs over seeded historical data.

**Constraint:** no commits in prod from me. Final commit is the user's call after review.

---

*Last updated: 2026-05-20*
