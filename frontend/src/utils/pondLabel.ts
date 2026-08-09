import type { Pond } from '../types';

/**
 * Resolve a display label for an alert's pond.
 *
 * Alerts reliably carry `pondId`, but `pondName` can arrive null from the
 * backend (reading-path alerts don't populate it). Fall back to resolving the
 * name from the loaded pond list so the UI never renders the literal "null".
 * A null `pondId` denotes a project-level alert (e.g. the electricity meter).
 */
export function pondLabel(
  pondName: string | null | undefined,
  pondId: string | null | undefined,
  ponds: Pond[],
): string {
  if (pondName && pondName !== 'null') return pondName;
  if (pondId) return ponds.find((p) => p.pond_id === pondId)?.name ?? 'Pond';
  return 'Project';
}
