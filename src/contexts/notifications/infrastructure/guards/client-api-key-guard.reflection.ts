import { GUARDS_METADATA } from '@nestjs/common/constants';

export interface MissingGuardClassViolation {
  className: string;
}

type AnyClass = new (...args: never[]) => unknown;

/**
 * Phase A allowlist (design.md D13/D21) — now EMPTY. `NotificationController`
 * and `NotificationMutationsResolver` were removed in task 28.2, and
 * `NotificationQueriesResolver` (`findById`) was removed in task 29.3, once
 * `@UseGuards(ClientApiKeyGuard)` was added to all three. Every
 * controller/resolver under `notifications/transport/` now carries the
 * class-level guard, and the reflection spec's own scan enforces it going
 * forward — this constant is kept (rather than deleted) as the documented
 * extension point for a future Phase A-style rollout.
 */
export const NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST = [] as const;

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
