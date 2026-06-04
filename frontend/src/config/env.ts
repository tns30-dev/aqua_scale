// Base URLs come from .env. Defaults route through the Vite dev proxy
// (server.proxy in vite.config.ts) in dev and through the production reverse
// proxy in prod — keeping cookies same-origin everywhere.
//
// apiBaseUrl: axios accepts an empty baseURL as "same-origin", so an empty
// VITE_API_BASE_URL is honored as-is. `??` (nullish) preserves an explicit "".
//
// wsBaseUrl: the WebSocket constructor REQUIRES an absolute URL, so an empty
// value isn't usable. When empty/missing we synthesize one from
// window.location matching the page's protocol (ws/wss) and host:port.
const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '';

const wsEnv = import.meta.env.VITE_WS_BASE_URL;
const wsBaseUrl: string =
  wsEnv && wsEnv.length > 0
    ? wsEnv
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export const config = {
  apiBaseUrl,
  wsBaseUrl,
};

