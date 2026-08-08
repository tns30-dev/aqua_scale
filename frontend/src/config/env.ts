// Local dev keeps same-origin so Vite can proxy /api and /ws. Hosted Firebase
// domains do not proxy those paths, so empty production env values must fall
// back to the public API edge.
const hostedApiBaseUrl = 'https://api.aquashield.live';
const hostedWsBaseUrl = 'wss://api.aquashield.live';
const hostedFrontendHosts = new Set([
  'www.aquashield.live',
  'aquashield.live',
  'aquashield-ms-dev-20260808.web.app',
]);

const isHostedFrontend = typeof window !== 'undefined'
  && hostedFrontendHosts.has(window.location.hostname);

const apiEnv = import.meta.env.VITE_API_BASE_URL;
const apiBaseUrl: string = apiEnv && apiEnv.length > 0
  ? apiEnv
  : isHostedFrontend ? hostedApiBaseUrl : '';

const wsEnv = import.meta.env.VITE_WS_BASE_URL;
const wsBaseUrl: string = wsEnv && wsEnv.length > 0
  ? wsEnv
  : isHostedFrontend
    ? hostedWsBaseUrl
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export const config = {
  apiBaseUrl,
  wsBaseUrl,
};
