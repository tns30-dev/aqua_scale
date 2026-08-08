import ws from 'k6/ws';
import { check } from 'k6';
import {
  WS_URL,
  apiRequest,
  bootstrapSession,
  envInt,
  parseJson,
} from './common.js';

const VUS = envInt('VUS', 50);
const HOLD_SECONDS = envInt('HOLD_SECONDS', 30);
const WS_ORIGIN = __ENV.WS_ORIGIN || __ENV.LOADTEST_ORIGIN || 'https://www.aquashield.live';

export const options = {
  noCookiesReset: true,
  scenarios: {
    fanout: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: __ENV.DURATION || `${HOLD_SECONDS + 30}s`,
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    ws_connecting: ['p(95)<2000'],
    ws_session_duration: [`p(95)<${(HOLD_SECONDS + 5) * 1000}`],
  },
};

export default function () {
  const session = bootstrapSession();
  if (!session.ready) return;

  const tokenResponse = apiRequest(session, 'POST', '/ws/token', undefined, 'B5 POST /ws/token');
  const token = parseJson(tokenResponse).token;
  check({ token }, {
    'B5 websocket token present': (value) => Boolean(value.token),
  });
  if (!token) return;

  let authOk = false;
  const upgrade = ws.connect(WS_URL, { headers: { Origin: WS_ORIGIN } }, (socket) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'AUTH', token }));
    });

    socket.on('message', (message) => {
      if (String(message).includes('AUTH_OK')) {
        authOk = true;
      }
    });

    socket.setTimeout(() => {
      socket.close();
    }, HOLD_SECONDS * 1000);
  });

  check(upgrade, {
    'B5 websocket upgraded': (response) => response && response.status === 101,
  });
  check({ authOk }, {
    'B5 websocket auth ok': (value) => value.authOk,
  });
}
