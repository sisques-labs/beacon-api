import { GUARDS_METADATA } from '@nestjs/common/constants';

export interface MissingGuardClassViolation {
  className: string;
}

type AnyClass = new (...args: never[]) => unknown;

/**
 * Phase A allowlist (design.md D13/D21): the transport classes this scan
 * MUST NOT flag yet, because Phase B — not this change — wires
 * `ClientApiKeyGuard` into them:
 * - `NotificationQueriesResolver` — `findById` moves behind the guard in
 *   task 29.3.
 * `NotificationController` and `NotificationMutationsResolver` were removed
 * from this list in task 28.2, once `@UseGuards(ClientApiKeyGuard)` was
 * added to both. This list MUST be empty once Phase B finishes (task
 * 29.3's reminder note).
 */
export const NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST = [
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
