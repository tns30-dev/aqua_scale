# Phase 7 — Vulnerability Resolution + Rescan (2026-08-09)

Rubric c.i/c.ii: resolution and rescan results. Consolidated findings from
Phase 2 (SAST/SCA), Phase 3 (image scan), and Phase 5 (DAST), with the fix +
rescan for the one gate-blocking item.

## Consolidated findings

| # | Source | Finding | Severity | Resolution |
|---|---|---|---|---|
| 1 | Trivy image (analytics) | `tar 7.5.11` node-tar gzip-bomb DoS, CVE-2026-59873 | CRITICAL | **FIXED + rescanned** (below) |
| 2 | Trivy image (analytics) | 7 HIGH in bundled npm deps (brace-expansion, ip-address, picomatch, sigstore, tar) | HIGH | **FIXED** as a side effect of #1 |
| 3 | Semgrep SAST | dynamic-urllib-use in `loadtests/pubsub_backlog.py:83` | WARNING | **HARDENED** — helper now rejects non-HTTP(S) Pub/Sub emulator URLs and suppresses only the audited `urlopen` call |
| 4 | ZAP DAST | Missing CSP / Permissions-Policy / Cross-Origin-Resource-Policy headers; nginx `Server` version leak | Low | Gateway-header hardening — deferred to the shared cloud edge (Codex owns the production gateway/Cloud Armor); tracked for the remote round |
| 5 | Trivy image (8 Java services) | ~15–27 HIGH each, JRE/OS base-layer CVEs, 0 CRITICAL | HIGH | Documented ratchet (same posture as `ci.yml`): CRITICAL gates, HIGH reported; base-image bump handled centrally |
| 6 | Trivy fs (repo deps) | 309 HIGH / 368 MEDIUM transitive Maven/npm | HIGH/MED | Reported artifact; 0 CRITICAL, no gate block |

## Resolved + rescanned: analytics image CRITICAL (finding #1)

**Root cause:** the CRITICAL `tar` was not an application dependency
(`npm ls tar` → empty; not in `package-lock.json`). It lived in the base
image's bundled global npm at
`/usr/local/lib/node_modules/npm/node_modules/tar`. The runtime is
`USER node` + `CMD ["node","dist/index.js"]` and never calls npm/npx.

**Fix** (`analytics-service/Dockerfile`, runtime stage, +4 lines):

```dockerfile
# The runtime runs `node dist/index.js` and never invokes npm/npx, so drop the
# base image's bundled global npm. It removes its vendored `tar` (CVE-2026-59873,
# node-tar gzip-bomb DoS) from the runtime image and shrinks the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
```

**Rescan (same tool/command), before vs after:**

```text
trivy image --severity CRITICAL,HIGH analytics-service:<tag>

BEFORE:  CRITICAL=1  HIGH=7   gate=FAIL
AFTER:   CRITICAL=0  HIGH=0   gate=PASS
```

Runtime unaffected: `node --version` → v22.23.2; the removed npm confirmed
absent (`ls /usr/local/lib/node_modules/npm` → No such file or directory).

Artifacts:
`artifacts/2026-08-09-trivy-image-analytics-BEFORE.json` and
`artifacts/2026-08-09-trivy-image-analytics-AFTER.json`.

## Note — findings deliberately NOT fixed here

- **Frontend test/lint failures** (Phase 1): resolved before the remote CI
  evidence branch; frontend lint, test, and build are green.
- **DAST header hardening** (#4): belongs on the shared production edge, not the
  local nginx rehearsal gateway — carried to the remote round.

## Phase verdict

| Check | Result |
|---|---|
| Findings consolidated across SAST/SCA/image/DAST | PASS |
| Gate-blocking CRITICAL fixed | PASS |
| Rescan before/after artifact pair captured | PASS |
| Non-fixable/out-of-scope items triaged + justified | PASS |
