import { GUARDS_METADATA } from '@nestjs/common/constants';
import { REQUIRES_TENANT_PERMISSION_KEY } from '@sisques-labs/nestjs-kit/rbac';

export interface GuardedMethodMetadataViolation {
  className: string;
  methodName: string;
}

type AnyClass = new (...args: never[]) => unknown;

/**
 * D11 safety net: `createTenantPermissionGuard()`'s own `canActivate()`
 * returns `true` when a guarded method carries no
 * `@RequiresTenantPermission(...)` metadata (verified in
 * `tenant-permission-guard.factory.js:28`), so a missing decorator is a
 * silent authorization bypass rather than a fail-closed default.
 *
 * Scans every method on `target`'s prototype (plus class-level metadata,
 * matching `Reflector#getAllAndOverride`'s own method-then-class precedence)
 * for `guardClass` in its `@UseGuards(...)` metadata, and reports every such
 * method that has no `@RequiresTenantPermission(...)` metadata.
 */
export function findGuardedMethodsMissingPermissionMetadata(
  target: AnyClass,
  guardClass: AnyClass,
): GuardedMethodMetadataViolation[] {
  const prototype = target.prototype as Record<string, unknown> | undefined;
  if (!prototype) {
    return [];
  }

  const classGuards = readGuards(target);
  const classPermission = Reflect.getMetadata(
    REQUIRES_TENANT_PERMISSION_KEY,
    target,
  ) as unknown;

  const violations: GuardedMethodMetadataViolation[] = [];

  for (const methodName of Object.getOwnPropertyNames(prototype)) {
    if (methodName === 'constructor') {
      continue;
    }
    const handler = prototype[methodName];
    if (typeof handler !== 'function') {
      continue;
    }

    const methodGuards = readGuards(handler);
    const isGuardedByTarget = [...classGuards, ...methodGuards].includes(
      guardClass,
    );
    if (!isGuardedByTarget) {
      continue;
    }

    const methodPermission = Reflect.getMetadata(
      REQUIRES_TENANT_PERMISSION_KEY,
      handler,
    ) as unknown;
    if (!methodPermission && !classPermission) {
      violations.push({ className: target.name, methodName });
    }
  }

  return violations;
}

function readGuards(target: object): AnyClass[] {
  return (
    (Reflect.getMetadata(GUARDS_METADATA, target) as AnyClass[] | undefined) ??
    []
  );
}
