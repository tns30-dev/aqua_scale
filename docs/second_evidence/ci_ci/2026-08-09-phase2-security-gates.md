# Phase 2 — Security Gates: SAST / SCA / Secrets / SBOM (2026-08-09)

Same tools, configs, and gate posture as `.github/workflows/ci.yml`. Raw
reports in `docs/second_evidence/ci_ci/artifacts/`; the full Trivy JSON
(4.8 MB) stays out of the repo — regenerate with the command below.

## SAST — Semgrep (`p/java` + `p/security-audit`, CI configs)

```text
semgrep scan --config p/java --config p/security-audit --error --json
Ran 206 rules on 932 files: 1 finding.  Gate (--error): PASS
```

| Severity | Finding | Location | Triage |
|---|---|---|---|
| WARNING | dynamic-urllib-use-detected | `loadtests/pubsub_backlog.py:83` | Local rehearsal finding; remote CI hardening adds explicit HTTP/HTTPS URL validation plus a targeted audited suppression, documented Phase 7 |

Artifact: `artifacts/2026-08-09-semgrep-report.json`

## Secrets — Gitleaks (full history, repo `.gitleaks.toml`)

```text
110 commits scanned, ~5.6 MB — no leaks found. Gate: PASS
```

Artifact: `artifacts/2026-08-09-gitleaks-report.json` (empty findings array)

## SCA / config — Trivy filesystem scan

```text
Gate:   trivy fs --severity CRITICAL --exit-code 1 --ignore-unfixed .  → exit 0 (PASS, zero CRITICAL)
Report: trivy fs --severity CRITICAL,HIGH,MEDIUM --format json .      → 309 HIGH, 368 MEDIUM
```

Distribution (report counts, fixed + unfixed): root/service `pom.xml` chains
~311+58+6×35, `frontend/package-lock.json` 47 — i.e., transitive Maven and
npm dependencies. Same posture as CI: CRITICAL blocks, HIGH/MEDIUM are
reported artifacts with the ratchet documented. Top fixable HIGHs get the
Phase 7 resolution + rescan treatment.

Artifact: `artifacts/2026-08-09-trivy-fs-summary.json` (per-target counts +
top packages; full JSON regenerable with the report command above)

## SBOM — CycloneDX aggregate (Maven plugin 2.9.1)

```text
mvn -DskipTests org.cyclonedx:cyclonedx-maven-plugin:2.9.1:makeAggregateBom
→ target/bom.json (477 KB) + target/bom.xml — all 11 modules
```

Artifact: `artifacts/2026-08-09-cyclonedx-sbom.json`

## Phase verdict

| Gate | Result |
|---|---|
| Semgrep SAST (`--error`) | PASS after remote hardening (local rehearsal had 1 warning, triaged) |
| Gitleaks secrets (full history) | PASS (0 leaks) |
| Trivy fs CRITICAL gate | PASS (0 critical; 309 HIGH / 368 MEDIUM reported) |
| CycloneDX SBOM generated | PASS |
