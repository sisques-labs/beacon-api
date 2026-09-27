import 'reflect-metadata';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Injectable, UseGuards } from '@nestjs/common';
import { RequiresTenantPermission } from '@sisques-labs/nestjs-kit/rbac';

import { NotificationsPermissionEnum } from '@contexts/notifications/domain/enums/notifications-permission.enum';
import { findGuardedMethodsMissingPermissionMetadata } from '@contexts/notifications/infrastructure/guards/notifications-tenant-permission-guard.reflection';
import { NotificationsTenantPermissionGuard } from '@contexts/notifications/infrastructure/guards/notifications-tenant-permission.guard';

/**
 * Fixture proving the check actually DETECTS a violation: a method guarded
 * by `NotificationsTenantPermissionGuard` with no `@RequiresTenantPermission`
 * — the exact silent-bypass shape D11 exists to prevent (the kit guard's own
 * `canActivate()` returns `true` when no permission metadata exists).
 */
@Injectable()
class FixtureControllerMissingPermission {
  @UseGuards(NotificationsTenantPermissionGuard)
  guardedMethodWithoutDecorator(): void {
    // Fixture only — never registered with a real module.
  }
}

@Injectable()
class FixtureControllerWithPermission {
  @UseGuards(NotificationsTenantPermissionGuard)
  @RequiresTenantPermission(
    NotificationsPermissionEnum.CHANNEL_DESTINATION_READ,
  )
  guardedMethodWithDecorator(): void {
    // Fixture only — never registered with a real module.
  }
}

type AnyClass = new (...args: never[]) => unknown;

const TRANSPORT_DIR = join(__dirname, '../../transport');

function collectTransportSourceFiles(dir: string): string[] {
  return (readdirSync(dir, { recursive: true, encoding: 'utf8' }) as string[])
    .filter(
      (file) =>
        (file.endsWith('.controller.ts') || file.endsWith('.resolver.ts')) &&
        !file.endsWith('.spec.ts'),
    )
    .map((file) => join(dir, file));
}

async function loadExportedClasses(filePath: string): Promise<AnyClass[]> {
  const moduleExports = (await import(pathToFileURL(filePath).href)) as Record<
    string,
    unknown
  >;
  return Object.values(moduleExports).filter(
    (exported): exported is AnyClass => typeof exported === 'function',
  );
}

describe('findGuardedMethodsMissingPermissionMetadata (D11)', () => {
  it('detects a guarded method with no @RequiresTenantPermission metadata', () => {
    const violations = findGuardedMethodsMissingPermissionMetadata(
      FixtureControllerMissingPermission,
      NotificationsTenantPermissionGuard,
    );

    expect(violations).toEqual([
      {
        className: 'FixtureControllerMissingPermission',
        methodName: 'guardedMethodWithoutDecorator',
      },
    ]);
  });

  it('reports no violation once @RequiresTenantPermission is present', () => {
    const violations = findGuardedMethodsMissingPermissionMetadata(
      FixtureControllerWithPermission,
      NotificationsTenantPermissionGuard,
    );

    expect(violations).toEqual([]);
  });

  it('finds every controller/resolver under notifications/transport/ has no unguarded gap', async () => {
    const files = collectTransportSourceFiles(TRANSPORT_DIR);
    expect(files.length).toBeGreaterThan(0);

    const classes = (await Promise.all(files.map(loadExportedClasses))).flat();
    expect(classes.length).toBeGreaterThan(0);

    const violations = classes.flatMap((target) =>
      findGuardedMethodsMissingPermissionMetadata(
        target,
        NotificationsTenantPermissionGuard,
      ),
    );

    // No transport method uses NotificationsTenantPermissionGuard yet
    // (Phase 8 wires the endpoints) — this MUST stay empty as each one is
    // added, never be edited to allow a known gap.
    expect(violations).toEqual([]);
  });
});
