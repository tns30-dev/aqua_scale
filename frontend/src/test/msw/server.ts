/**
 * MSW server for Node.js (vitest).
 * Started in setup.ts, used by all integration tests.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
