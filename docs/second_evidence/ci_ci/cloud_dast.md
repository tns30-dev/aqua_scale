# Cloud DAST Evidence

Date: 2026-08-09

Target: `https://api.aquashield.live/api/csrf`

| Check | Evidence |
|---|---|
| GitHub Actions run | `31285427025`, commit `4b16fb8472c1036258fa5ae05f94b9ef9efc5350`, conclusion `success`. |
| Tool | OWASP ZAP baseline scan from `.github/workflows/dast.yml`. |
| Artifact | `artifacts/cloud-dast/zap-report.html`, `artifacts/cloud-dast/zap-report.md`, `artifacts/cloud-dast/zap-report.json`. |
| Result | High: 0, Medium: 1, Low: 3, Informational: 3. The workflow completed successfully and produced downloadable evidence. |
| Main findings | Security header hardening: CSP missing on `/api`, HSTS missing on public 404/static routes, Permissions-Policy missing on `/api`, and CSRF cookie lacks `HttpOnly`. |
| Remediation note | Add API-edge response headers for CSP, HSTS, and Permissions-Policy. Review CSRF handling: if the frontend reads the token from the JSON body, the cookie can be marked `HttpOnly`; if the cookie itself is used by client JavaScript, keep the current behavior and document the tradeoff. |
