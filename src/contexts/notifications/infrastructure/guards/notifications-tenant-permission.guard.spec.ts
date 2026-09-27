import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Mocked, vi } from 'vitest';

import { NotificationsPermissionEnum } from '@contexts/notifications/domain/enums/notifications-permission.enum';
import {
  NOTIFICATIONS_ROLE_PERMISSIONS,
  NotificationsTenantPermissionGuard,
} from '@contexts/notifications/infrastructure/guards/notifications-tenant-permission.guard';

function buildContext(
  tenantId: string,
  role: string,
  membershipTenantId: string = tenantId,
): ExecutionContext {
  const request = {
    params: { tenantId },
    user: { tenants: [{ tenantId: membershipTenantId, role }] },
  };
  return {
    getHandler: () => (): void => undefined,
    getClass: () => class {},
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildReflector(requiredPermission: unknown): Mocked<Reflector> {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(requiredPermission),
  } as unknown as Mocked<Reflector>;
}

describe('NOTIFICATIONS_ROLE_PERMISSIONS', () => {
  it('grants OWNER both channel-destination permissions (D11, unconfirmed role names)', () => {
    expect(NOTIFICATIONS_ROLE_PERMISSIONS.OWNER).toEqual([
      NotificationsPermissionEnum.CHANNEL_DESTINATION_MANAGE,
      NotificationsPermissionEnum.CHANNEL_DESTINATION_READ,
    ]);
  });

  it('grants ADMIN both channel-destination permissions', () => {
    expect(NOTIFICATIONS_ROLE_PERMISSIONS.ADMIN).toEqual([
      NotificationsPermissionEnum.CHANNEL_DESTINATION_MANAGE,
      NotificationsPermissionEnum.CHANNEL_DESTINATION_READ,
    ]);
  });

  it('grants MEMBER read-only', () => {
    expect(NOTIFICATIONS_ROLE_PERMISSIONS.MEMBER).toEqual([
      NotificationsPermissionEnum.CHANNEL_DESTINATION_READ,
    ]);
  });
});

describe('NotificationsTenantPermissionGuard', () => {
  it('allows the request when no @RequiresTenantPermission metadata exists', () => {
    const guard = new NotificationsTenantPermissionGuard(
      buildReflector(undefined),
    );

    expect(guard.canActivate(buildContext('tenant-1', 'MEMBER'))).toBe(true);
  });

  it('allows a MEMBER requesting the granted READ permission', () => {
    const guard = new NotificationsTenantPermissionGuard(
      buildReflector(NotificationsPermissionEnum.CHANNEL_DESTINATION_READ),
    );

    expect(guard.canActivate(buildContext('tenant-1', 'MEMBER'))).toBe(true);
  });

  it('allows an OWNER requesting the MANAGE permission', () => {
    const guard = new NotificationsTenantPermissionGuard(
      buildReflector(NotificationsPermissionEnum.CHANNEL_DESTINATION_MANAGE),
    );

    expect(guard.canActivate(buildContext('tenant-1', 'OWNER'))).toBe(true);
  });

  it('rejects a MEMBER requesting the ungranted MANAGE permission', () => {
    const guard = new NotificationsTenantPermissionGuard(
      buildReflector(NotificationsPermissionEnum.CHANNEL_DESTINATION_MANAGE),
    );

    expect(() => guard.canActivate(buildContext('tenant-1', 'MEMBER'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a caller with no membership for the resolved tenant', () => {
    const guard = new NotificationsTenantPermissionGuard(
      buildReflector(NotificationsPermissionEnum.CHANNEL_DESTINATION_READ),
    );

    expect(() =>
      guard.canActivate(buildContext('tenant-1', 'OWNER', 'tenant-2')),
    ).toThrow(ForbiddenException);
  });
});
