/**
 * TS port of the platform resource-service auth flow (main/authn_authz.md, mirrors
 * common/JwtVerifier + AuthzSnapshotConsumer + SnapshotAuthFilter):
 *  1. verify the RS256 JWT locally with Identity's PUBLIC key (iss/aud/exp),
 *  2. load the Redis authz snapshot at the token's authzVersion,
 *  3. snapshot present -> principal; missing/unreadable -> FAIL CLOSED (401).
 */

import type { NextFunction, Request, Response } from 'express';
import { createPublicKey, KeyObject } from 'node:crypto';
import { jwtVerify } from 'jose';

/** Canonical snapshot shape (main/redis.md "Authorization Snapshot Shape"). */
export interface AuthzSnapshot {
  userId: string;
  version: number;
  roleType: string;
  features: unknown[];
  projectIds: string[] | null;
  pondIdsByProject: Record<string, string[]>;
  deviceIdsByProject: Record<string, string[]>;
  deniedFeatures: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface Principal {
  userId: string;
  role: string;
  snapshot: AuthzSnapshot;
}

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export function hasProjectAccess(snapshot: AuthzSnapshot, projectId: string): boolean {
  return Array.isArray(snapshot.projectIds) && snapshot.projectIds.includes(projectId);
}

export class JwtVerifier {
  private readonly key: KeyObject;

  constructor(publicKeyPem: string, private readonly issuer: string,
              private readonly audience: string) {
    this.key = createPublicKey(publicKeyPem);
  }

  /** Returns claims or throws (signature/iss/aud/exp). */
  async verify(token: string): Promise<{ sub: string; role: string; authzVersion: number }> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.authzVersion !== 'number') {
      throw new Error('missing required claims');
    }
    return {
      sub: payload.sub,
      role: typeof payload.role === 'string' ? payload.role : '',
      authzVersion: payload.authzVersion,
    };
  }
}

/** Empty result = missing/stale/unreadable -> caller MUST fail closed. */
export async function loadSnapshot(
  kv: KV, userId: string, version: number): Promise<AuthzSnapshot | null> {
  const json = await kv.get(`authz:snapshot:${userId}:${version}`);
  if (json === null) {
    return null;
  }
  try {
    return JSON.parse(json) as AuthzSnapshot;
  } catch {
    return null; // unreadable -> treat as missing (fail closed)
  }
}

type AuthToken = { token: string; fromCookie: boolean };

export function cookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const cookie = part.trim();
    if (cookie.startsWith(prefix)) {
      const value = cookie.slice(prefix.length).trim();
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function bearerOrCookie(req: Request): AuthToken | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token ? { token, fromCookie: false } : null;
  }
  const cookieToken = cookieValue(req.headers.cookie, 'access_token');
  return cookieToken ? { token: cookieToken, fromCookie: true } : null;
}

function unsafeMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase());
}

function csrfMatches(req: Request): boolean {
  const header = req.header('X-CSRFToken') ?? req.header('X-CSRF-Token');
  const cookie = cookieValue(req.headers.cookie, 'csrftoken');
  return !!header && !!cookie && header === cookie;
}

declare module 'express-serve-static-core' {
  interface Request {
    principal?: Principal;
  }
}

export function authMiddleware(verifier: JwtVerifier, kv: KV) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authToken = bearerOrCookie(req);
    if (!authToken) {
      res.status(401).json({ detail: 'Authentication credentials were not provided.' });
      return;
    }
    if (authToken.fromCookie && unsafeMethod(req.method) && !csrfMatches(req)) {
      res.status(403).json({ detail: 'CSRF verification failed.' });
      return;
    }
    try {
      const claims = await verifier.verify(authToken.token);
      const snapshot = await loadSnapshot(kv, claims.sub, claims.authzVersion);
      if (snapshot === null) {
        // fail closed: client refreshes (Identity rebuilds the snapshot) and retries
        res.status(401).json({ detail: 'Authentication credentials were not provided.' });
        return;
      }
      req.principal = { userId: claims.sub, role: claims.role, snapshot };
      next();
    } catch {
      res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    }
  };
}
