# Firebase Hosting Deploy (Microservice Environment) - 2026-08-08

## Scope

Deploy the React/Vite frontend to Firebase Hosting under the new microservice
GCP project. The old monolith projects (`aquashield-staging`,
`aerobic-guide-498413-u6`) were not touched.

- Firebase/GCP project: `aquashield-ms-dev-20260808`
- Firebase Hosting site: `aquashield-ms-dev-20260808` (default site, live channel)
- Hosting URL: `https://aquashield-ms-dev-20260808.web.app`
- Public API base baked into the bundle: `https://api.aquashield.live`
- Public WSS base baked into the bundle: `wss://api.aquashield.live`
- Custom frontend domain: `www.aquashield.live` (bound to the new site and
  serving over valid HTTPS)

## Firebase Enablement

The new GCP project had no Firebase resources yet, so Firebase was added to the
new project only:

```text
firebase --account aquashieldnus@gmail.com projects:addfirebase aquashield-ms-dev-20260808

✔ Adding Firebase resources to Google Cloud Platform project
Project ID: aquashield-ms-dev-20260808
```

The default Hosting site was auto-provisioned:

```text
firebase --account aquashieldnus@gmail.com hosting:sites:list --project aquashield-ms-dev-20260808

Site ID: aquashield-ms-dev-20260808
Default URL: https://aquashield-ms-dev-20260808.web.app
```

## Project Binding

`frontend/.firebaserc` was rebound from the retired first-round project to the
new microservice project:

```json
{
  "projects": {
    "default": "aquashield-ms-dev-20260808"
  }
}
```

`frontend/firebase.json` was unchanged (deploys `dist/` with SPA rewrite to
`/index.html`, immutable caching for `/assets/**`, `no-cache` for `index.html`).

## API Base URL Configuration

The app reads its endpoints from `frontend/src/config/env.ts` via
`VITE_API_BASE_URL` / `VITE_WS_BASE_URL`. The checked-in `.env` files keep these
empty (same-origin via the dev proxy); production values are injected as shell
environment variables at build time, which override `.env` files in Vite. No
source changes were needed.

## Production Build

Build command (from `frontend/`):

```text
VITE_API_BASE_URL=https://api.aquashield.live \
VITE_WS_BASE_URL=wss://api.aquashield.live \
npm run build
```

Result:

```text
PASS (tsc -b && vite build, 2655 modules, built in 3.07s)

dist/index.html                     0.46 kB
dist/assets/index-Dq5eKF6K.css     65.67 kB
dist/assets/index-DpdI393j.js   2,000.03 kB
```

Bundle contains the expected public endpoints:

```text
grep -o "https://api.aquashield.live\|wss://api.aquashield.live" dist/assets/*.js

https://api.aquashield.live
wss://api.aquashield.live
```

## Firebase Deploy

Deploy command (from `frontend/`):

```text
firebase --account aquashieldnus@gmail.com deploy \
  --only hosting \
  --project aquashield-ms-dev-20260808
```

Result:

```text
✔ hosting[aquashield-ms-dev-20260808]: found 9 files in dist, upload complete
✔ hosting[aquashield-ms-dev-20260808]: version finalized, release complete
✔ Deploy complete!

Hosting URL: https://aquashield-ms-dev-20260808.web.app
```

## Validation

Hosting root loads over HTTPS:

```text
curl -I https://aquashield-ms-dev-20260808.web.app

HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31556926; includeSubDomains; preload
```

SPA rewrite serves the app shell for the login route:

```text
curl -I https://aquashield-ms-dev-20260808.web.app/login

HTTP/2 200
content-type: text/html; charset=utf-8
```

Served HTML references the deployed production assets:

```html
<title>AquaShield</title>
<script type="module" crossorigin src="/assets/index-DpdI393j.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-Dq5eKF6K.css">
```

The deployed (served) JS bundle points API calls at the public API edge:

```text
curl -s https://aquashield-ms-dev-20260808.web.app/assets/index-DpdI393j.js \
  | grep -o "https://api.aquashield.live\|wss://api.aquashield.live" | sort -u

https://api.aquashield.live
wss://api.aquashield.live
```

## Blocked: Backend DNS/TLS Not Cut Over Yet

End-to-end API validation from the deployed frontend is blocked on the DNS/TLS
cutover for `api.aquashield.live`, which is in progress separately (Codex owns
DNS/Istio/edge for the new environment):

```text
dig +short api.aquashield.live          -> 8.232.154.25   (old edge)
dig @8.8.8.8 +short api.aquashield.live -> 8.232.154.25   (old edge)

Expected new microservice API edge IP (Terraform output): 34.54.25.36

curl -sSI https://api.aquashield.live/
curl: (35) Recv failure: Connection reset by peer
```

Per the second-round plan, no backend or DNS configuration was changed from
this task. Once `api.aquashield.live` resolves to `34.54.25.36` and the
GCP-managed certificate is `ACTIVE`, login through the hosted frontend can be
re-validated with no frontend redeploy needed (the bundle already targets the
final domain).

## Custom Domain: www.aquashield.live Re-Pointed To The New Site

The first-round custom domain was found dead: `www.aquashield.live` still
CNAMEs to the retired first-round site, whose project no longer exists.

```text
dig +short www.aquashield.live CNAME -> aerobic-guide-498413-u6.web.app.
curl -I https://aerobic-guide-498413-u6.web.app -> HTTP/2 404 (Site Not Found)
curl https://www.aquashield.live -> TLS verification failure (exit 60)
```

Because the old target is already gone, re-pointing the domain is a repair,
not a live-traffic migration. The custom domain binding was created on the new
Hosting site via the Firebase Hosting API:

```text
POST /v1beta1/projects/aquashield-ms-dev-20260808/sites/aquashield-ms-dev-20260808/customDomains?customDomainId=www.aquashield.live
```

Current binding state and the DNS update Firebase requires:

```text
hostState: HOST_ACTIVE
ownershipState: OWNERSHIP_MISSING   (CNAME still targets the old site)
cert.state: CERT_VALIDATING

requiredDnsUpdates.desired:
  CNAME www.aquashield.live -> aquashield-ms-dev-20260808.web.app
requiredDnsUpdates.discovered:
  CNAME www.aquashield.live -> aerobic-guide-498413-u6.web.app
```

Required Namecheap change (manual, account access needed):

```text
CHANGE  CNAME  www  aerobic-guide-498413-u6.web.app  ->  aquashield-ms-dev-20260808.web.app
DELETE  TXT    _acme-challenge.www                       (stale first-round ACME record)
```

The user updated the Namecheap CNAME (`www` ->
`aquashield-ms-dev-20260808.web.app`); the stale first-round
`_acme-challenge.www` TXT record was left in place, which is harmless — Firebase
only required the CNAME change. After propagation, ownership validated and the
domain went live:

```text
dig @8.8.8.8 +short www.aquashield.live CNAME -> aquashield-ms-dev-20260808.web.app.

Firebase customDomains API (polled every 60s):
hostState: HOST_ACTIVE
ownershipState: OWNERSHIP_ACTIVE
cert.state: CERT_PROPAGATING   (provider-side rollout state; domain already serves valid HTTPS)
```

Custom domain HTTPS checks:

```text
curl -I https://www.aquashield.live        -> HTTP/2 200, text/html
curl    https://www.aquashield.live        -> <title>AquaShield</title>, /assets/index-DpdI393j.js
curl -I https://www.aquashield.live/login  -> HTTP/2 200 (SPA rewrite)
```

The served asset hash matches this deploy, confirming the custom domain serves
the new microservice frontend. Note for the API edge: browser calls from
`https://www.aquashield.live` require that origin in the new environment's
CORS allow-list (Codex edge scope).

## Summary

| Check | Result |
|---|---|
| Firebase added to `aquashield-ms-dev-20260808` | Pass |
| `frontend/.firebaserc` rebound to new project | Pass |
| Production build with public API/WSS base URLs | Pass |
| Deploy to Hosting live channel | Pass |
| Hosting URL + `/login` SPA shell load (HTTP 200) | Pass |
| Served bundle targets `https://api.aquashield.live` | Pass |
| Live API call through `api.aquashield.live` | Blocked on DNS/TLS cutover |
| `www.aquashield.live` bound to new site | Pass (`OWNERSHIP_ACTIVE`) |
| `www.aquashield.live` serving new frontend over HTTPS | Pass (root + `/login` 200, deployed asset hash) |
