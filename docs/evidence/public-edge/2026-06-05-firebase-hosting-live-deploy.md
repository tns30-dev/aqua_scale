# Firebase Hosting Live Deploy - 2026-06-05

## Scope

This evidence proves the React/Vite frontend was deployed to Firebase Hosting in the same Firebase/GCP project as the live managed backend.

- Firebase/GCP project: `aerobic-guide-498413-u6`
- Firebase Hosting site: `aerobic-guide-498413-u6`
- Default Hosting URL: `https://aerobic-guide-498413-u6.web.app`
- Public API base baked into frontend bundle: `https://api.aquashield.live`
- Public WSS base baked into frontend bundle: `wss://api.aquashield.live`
- Custom frontend domain requested: `www.aquashield.live`
- Backend API domain remains: `api.aquashield.live`

## Project Binding

Firebase CLI can see the Firebase-enabled project:

```text
firebase --account aquashieldnus@gmail.com projects:list --json

projectId: aerobic-guide-498413-u6
projectNumber: 294489509399
displayName: aquashield
resources.hostingSite: aerobic-guide-498413-u6
state: ACTIVE
```

The frontend directory now binds its default Firebase target to the live project:

```text
frontend/.firebaserc

{
  "projects": {
    "default": "aerobic-guide-498413-u6"
  }
}
```

## Production Build

Build command:

```text
VITE_API_BASE_URL=https://api.aquashield.live \
VITE_WS_BASE_URL=wss://api.aquashield.live \
npm run build
```

Result:

```text
PASS

dist/index.html
dist/assets/index-0DUgRRq0.css
dist/assets/index-CLPvtwfA.js
```

The deployed bundle contains the expected live endpoints:

```text
https://api.aquashield.live
wss://api.aquashield.live
```

## Firebase Deploy

Deploy command:

```text
firebase --account aquashieldnus@gmail.com deploy \
  --only hosting \
  --project aerobic-guide-498413-u6 \
  --json
```

Result:

```json
{
  "status": "success",
  "result": {
    "hosting": "projects/294489509399/sites/aerobic-guide-498413-u6/versions/e3363fbcc53afb20"
  }
}
```

Hosting site listing:

```json
{
  "defaultUrl": "https://aerobic-guide-498413-u6.web.app",
  "type": "DEFAULT_SITE"
}
```

## Live URL Checks

Default Firebase Hosting URL:

```text
curl -I https://aerobic-guide-498413-u6.web.app

HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31556926; includeSubDomains; preload
```

SPA route rewrite:

```text
curl -I https://aerobic-guide-498413-u6.web.app/login

HTTP/2 200
content-type: text/html; charset=utf-8
```

Index HTML references the deployed production asset:

```html
<script type="module" crossorigin src="/assets/index-CLPvtwfA.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-0DUgRRq0.css">
```

## Custom Domain Setup

Firebase Hosting custom-domain binding was created for:

```text
www.aquashield.live
```

Required Namecheap DNS records:

```text
CNAME  www                  aerobic-guide-498413-u6.web.app
TXT    _acme-challenge.www  LKIxNWob1sr9XJ4by14nbYnjOHwjJfwn43vbmmTIfdY
```

DNS propagation checks passed:

```text
dig +short www.aquashield.live CNAME
aerobic-guide-498413-u6.web.app.

dig @8.8.8.8 +short www.aquashield.live CNAME
aerobic-guide-498413-u6.web.app.

dig +short _acme-challenge.www.aquashield.live TXT
"LKIxNWob1sr9XJ4by14nbYnjOHwjJfwn43vbmmTIfdY"

dig @8.8.8.8 +short _acme-challenge.www.aquashield.live TXT
"LKIxNWob1sr9XJ4by14nbYnjOHwjJfwn43vbmmTIfdY"
```

Firebase status after DNS propagation:

```text
hostState: HOST_ACTIVE
ownershipState: OWNERSHIP_ACTIVE
cert.state: CERT_PROPAGATING
requiredDnsUpdates.discovered matches requiredDnsUpdates.desired
```

Custom domain HTTPS checks:

```text
curl -I https://www.aquashield.live

HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31556926

curl https://www.aquashield.live

HTTP 200 body contains:
<title>AquaShield</title>
<script type="module" crossorigin src="/assets/index-CLPvtwfA.js"></script>

curl https://www.aquashield.live/login

HTTP 200 body contains:
<title>AquaShield</title>
<script type="module" crossorigin src="/assets/index-CLPvtwfA.js"></script>
```

Interpretation: Namecheap DNS is correct and public, Firebase Hosting has accepted host ownership for `www.aquashield.live`, and browser-valid HTTPS serves the AquaShield SPA. Firebase's API still reports the certificate as `CERT_PROPAGATING`, which is the expected provider-side rollout state after the domain is already reachable.
