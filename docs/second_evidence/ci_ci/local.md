# Local CI/CD Rehearsal Plan - 2026-08-09

> **STATUS: COMPLETE (2026-08-09).** All 9 phases executed. Evidence in this
> folder (`README.md` indexes phase0–8) and `../performance/`. Headline: Java
> 127/127 + analytics 50/50 tests; 0 CRITICAL fs scan; DAST 0 FAIL; k6 load p95
> 11.5 ms / stress knee 500 VUs / growth 864 ms / websocket 50/50; analytics
> image `tar` CRITICAL found + fixed + rescanned clean. Remote round pending
> Codex "environment stable".

Owner: Claude (CI/CD duty). Codex is finishing cloud deployment (DNS/Istio/data)
in parallel; nothing here touches the cloud environment.

## Purpose

Rehearse the full DevSecOps pipeline locally against the running Docker Compose
stack, producing every artifact class the second-round rubric asks for, so the
remote (GitHub Actions) round is a re-run against `https://api.aquashield.live`
rather than a first attempt.

Rubric target (Other Technical Assessment - DevSecOps): pipelines/tools, unit
test artifacts, integration test artifacts, load AND stress test artifacts,
SAST, DAST, container management (build/save, image security, inspect, logs),
vulnerability resolution + rescan, compliance as code (IaC + git audit trail),
regulatory framework mapping. Plus the 5-minute CI/CD demo video.

## What we reuse from round one

- `.github/workflows/ci.yml` — path-aware build/test/scan matrix (the local
  rehearsal mirrors its jobs 1:1 so evidence matches the pipeline).
- `.github/workflows/deploy-handoff.yml` — already targets
  `aquashield-ms-dev-20260808` via OIDC/WIF (remote round only).
- `.github/workflows/perf.yml` — k6 lane (busy-day / herd / websocket / growth).
- `loadtests/k6/*` scripts + `loadtests/pubsub_backlog.py`.
- Local stack: `./scripts/up.sh` compose environment — 9 services behind nginx
  `:8080`, Postgres 16 `:5433` (million-record dataset), Redis, Pub/Sub and
  Bigtable emulators.

New in this round: DAST (OWASP ZAP) and the dedicated stress lane — neither has
evidence yet.

## Evidence convention

Every step drops its artifact under `docs/second_evidence/ci_ci/` (this folder)
or `docs/second_evidence/performance/` for k6 output, named
`2026-08-XX-<step>.<ext>`. Each phase gets a short dated section appended to
this file (or a sibling evidence file) with the command + result.

---

## Phase 0 — Preflight (environment proof)

- [ ] Capture `docker compose --profile app ps` — all 14 containers healthy.
- [ ] Capture tool versions: `java -version`, `mvn -v`, `node -v`, `docker -v`,
      `trivy -v`, `semgrep --version`, `gitleaks version`, k6 (docker image tag),
      ZAP (docker image tag).
- [ ] Prove the dataset scale: `psql -h localhost -p 5433` row counts on the
      big telemetry/consumption tables — this is the "millions of records"
      context for every load/stress figure that follows.
- [ ] Verify gateway healthy: `curl http://localhost:8080/healthz` (or gateway
      health route) + admin login smoke.

## Phase 1 — CI: build + unit + integration tests (rubric a.ii, a.iii)

- [ ] Java reactor: `mvn -B clean verify` (unit + Testcontainers integration,
      same command as `ci.yml` java-verify job, run per-service or full reactor).
- [ ] Collect `**/target/surefire-reports/` (unit) and `**/target/failsafe-reports/`
      (integration) — archive the summary counts as the result artifact.
- [ ] Analytics (TS): `npm ci && npm run build && npm test` in `analytics-service/`
      + `npm audit --omit=dev --audit-level=high`.
- [ ] Frontend: `npm ci && npm run lint && npx vitest run && npm run build` in
      `frontend/` (mirrors `frontend-ci-cd.yml`).
- [ ] Record one pass/fail table: service → unit count → integration count.

## Phase 2 — CI: security gates (rubric a.v SAST, plus SCA/secrets/SBOM)

- [ ] SAST: `semgrep scan --config p/java --config p/security-audit --error --json`
      (same configs as `ci.yml`) → save JSON + human-readable summary.
- [ ] SCA/config: Trivy filesystem scan, gate CRITICAL, report CRITICAL/HIGH/MEDIUM
      JSON (same posture as `ci.yml`).
- [ ] Secrets: gitleaks over full history → report (expect clean).
- [ ] SBOM: CycloneDX aggregate bom via Maven plugin + `cyclonedx-npm` for
      analytics/frontend if time allows.
- [ ] File any finding worth fixing → feeds Phase 7 resolution/rescan loop.

## Phase 3 — Container management (rubric b.i–b.iv)

- [ ] Build all 9 service images from the current git SHA (same
      `docker build -f <svc>/Dockerfile .` shape as CI).
- [ ] Image security: Trivy image scan per service, gate CRITICAL — save one
      combined report (rubric b.ii).
- [ ] Saving images: `docker images` listing with SHA tags + `docker save` one
      representative image to a tarball (local stand-in for registry push;
      remote round shows Artifact Registry) (rubric b.i).
- [ ] Interact/inspect: `docker inspect` (config, healthcheck, non-root user),
      `docker exec` into a service showing process/user, `docker stats` snapshot
      (rubric b.iii).
- [ ] Container logs: `docker logs` capture from 2–3 services showing structured
      startup + request logs (rubric b.iv).

## Phase 4 — CD rehearsal: deploy the built images locally

- [ ] Recreate the compose stack from the freshly built SHA-tagged images
      (`./scripts/up.sh` rebuild path) — local stand-in for the Argo CD sync.
- [ ] All health checks green after rollout; capture `docker compose ps`.
- [ ] Post-deploy smoke: scripted login → projects → charts → websocket flow
      (the `docs/LOCAL_E2E.md` harness + `scripts/seed-demo.sh`) — this is the
      smoke-test design the remote pipeline reuses after Argo sync.

## Phase 5 — DAST: OWASP ZAP against the local gateway (rubric a.vi)

- [ ] ZAP baseline scan (docker `zaproxy/zap-stable`, `zap-baseline.py`) against
      `http://localhost:8080` (nginx gateway = the local cloud-edge stand-in).
- [ ] Authenticated pass: mint a JWT via the login API, feed it as a ZAP header
      so protected routes are exercised, not just 401s.
- [ ] Save HTML + JSON reports; summarize alerts by risk level.
- [ ] Triage: classify each alert (fix / accepted-with-justification) → feeds
      Phase 7.

## Phase 6 — Load AND stress testing, million-record dataset (rubric a.iv)

Target: nginx gateway `http://localhost:8080`, k6 in docker (same image as
`perf.yml`, `grafana/k6:0.54.0`). Pass/fail anchored on the ~3s response-time
requirement. Compose results are labeled LOCAL REHEARSAL per
`docs/second_evidence/README.md`; the cloud-native re-run comes in the remote
round.

- [ ] Load (sustained realistic mix): `busy-day.js` at ~50 VUs for a sustained
      window → p95/p99, error rate, throughput summary.
- [ ] Stress (find the knee): staged ramp of `busy-day.js`/`thundering-herd.js`
      well past normal load (e.g., 50 → 100 → 200 → 400 VUs) until latency or
      errors degrade; record the breaking curve and where 3s p95 is crossed.
- [ ] Spike/growth: `growth-probe.js` (repeat probes over the growing dataset)
      + a short spike profile (sudden jump to high VUs, observe recovery).
- [ ] Real-time: `websocket-fanout.js` — connection success, message latency
      under concurrent fans.
- [ ] Ingestion drain: `loadtests/pubsub_backlog.py` — publish a backlog to the
      emulator, measure drain rate through ingestion.
- [ ] Export every k6 `--summary-export` JSON into
      `docs/second_evidence/performance/` with a one-table pass/fail rollup
      (scenario → VUs → p95 → error % → verdict vs 3s target).

## Phase 7 — Vulnerability resolution + rescan (rubric c.i, c.ii)

- [ ] Consolidate findings from Phase 2 (SAST/SCA) + Phase 3 (image) + Phase 5
      (DAST) into one findings table: finding → severity → resolution.
- [ ] Fix what is fixable (dependency bumps, config/header hardening, code fix);
      justify anything accepted as-is.
- [ ] Rescan with the SAME tools/commands → before/after artifact pair
      (this is the explicit rubric line — keep both reports).

## Phase 8 — Compliance as code + regulatory mapping (rubric d, e)

- [ ] IaC artifacts: `terraform fmt -check -recursive infra` +
      `terraform -chdir=infra/environments/dev validate` output; `kubectl
      kustomize k8s/overlays/dev` render proof (tools: Terraform, Kustomize).
- [ ] Version-control audit trail: `git log` extract showing conventional
      commits, GitOps bot commits (`chore(gitops): update dev images…`), and
      the PR/branch flow.
- [ ] Short mapping doc: how the pipeline controls map to a named framework
      (GDPR-leaning: least-privilege IAM, no long-lived keys via OIDC/WIF,
      secret scanning, TLS everywhere, audit-service trail, data minimization
      in JWT claims).

## Phase 9 — Package evidence + tracker sync

- [ ] Index every artifact in this folder's evidence files with dates.
- [ ] Update `cooking_tracker/claude/ci_cd_and_testing_tracker.md` (+
      `security_tracker.md` for scan evidence) after each phase.
- [ ] Note what the 5-min CI/CD demo video will show, in order: pipeline
      run → test artifacts → scans → container build/scan → deploy → smoke →
      k6 → ZAP → resolution/rescan.

---

## Remote round (starts when Codex declares the cloud environment stable)

Preview only — separate plan file (`remote.md`) when we get there:

- Re-run `ci.yml` + `deploy-handoff.yml` end-to-end on GitHub: path-aware CI →
  GAR push (OIDC/WIF) → Kustomize bump → Argo CD sync evidence.
- Add a DAST workflow (ZAP baseline vs `https://api.aquashield.live`) and run
  the k6 lane (`perf.yml`) against the deployed API + WSS for the cloud-native
  performance evidence (load, stress, growth, websocket) — the only results
  that count as final per the evidence rules.
- Branch protection + pinned action SHAs + scoped token screenshot evidence.
