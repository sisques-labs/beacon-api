import { GUARDS_METADATA } from '@nestjs/common/constants';

export interface MissingGuardClassViolation {
  className: string;
}

type AnyClass = new (...args: never[]) => unknown;

/**
 * Phase A allowlist (design.md D13/D21): the transport classes this scan
 * MUST NOT flag yet, because Phase B — not this change — wires
 * `ClientApiKeyGuard` into them:
 * - `NotificationController` — creation (task 28.2) and `findById` (task
 *   29.3) both move behind the guard in Phase B.
 * - `NotificationMutationsResolver` — creation moves behind the guard in
 *   task 28.2.
 * - `NotificationQueriesResolver` — `findById` moves behind the guard in
 *   task 29.3.
 * Remove each entry from this list in the same task that adds
 * `@UseGuards(ClientApiKeyGuard)` to it — tasks 28.2 and 29.3 already carry
 * a reminder note. This list MUST be empty once Phase B finishes.
 */
export const NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST = [
  'NotificationController',
  'NotificationMutationsResolver',
  'NotificationQueriesResolver',
] as const;

/**
 * D21 safety net (replaces the superseded D11 method-level reflection check
 * — see the closed #116/7.2 history): `ClientApiKeyGuard` (design.md D21) is
 * applied at the CLASS level via `@UseGuards(ClientApiKeyGuard)`, not per
 * method, so a missing class-level decorator silently leaves every method
 * on that controller/resolver unauthenticated.
 *
 * Reports `target` as a violation unless it carries `guardClass` in its
 * class-level `@UseGuards(...)` metadata, or its name is in `allowlist` —
 * the Phase A classes design.md D13 deliberately leaves unguarded until
 * Phase B (see `NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST` above).
 */
export function findClassesMissingGuard(
  target: AnyClass,
  guardClass: AnyClass,
  allowlist: readonly string[],
): MissingGuardClassViolation[] {
  if (allowlist.includes(target.name)) {
    return [];
  }

  if (readGuards(target).includes(guardClass)) {
    return [];
  }

  return [{ className: target.name }];
}

function readGuards(target: object): AnyClass[] {
  return (
    (Reflect.getMetadata(GUARDS_METADATA, target) as AnyClass[] | undefined) ??
    []
  );
}
