import { CanActivate, Type } from '@nestjs/common';
import { createTenantPermissionGuard } from '@sisques-labs/nestjs-kit/rbac';

import { NotificationsPermissionEnum } from '@contexts/notifications/domain/enums/notifications-permission.enum';

/**
 * Role → permission map for the `notifications` context (design.md D11).
 *
 * UNCONFIRMED: the role names `OWNER`/`ADMIN`/`MEMBER` are a placeholder and
 * MUST be confirmed against the Sisques Account claim vocabulary before this
 * ships (see openspec design.md "Open Questions"). Only this map depends on
 * the exact role names — `NotificationsTenantPermissionGuard` and every
 * consumer of `NotificationsPermissionEnum` are unaffected by a rename here.
 */
export const NOTIFICATIONS_ROLE_PERMISSIONS: Record<
  string,
  NotificationsPermissionEnum[]
> = {
  OWNER: [
    NotificationsPermissionEnum.CHANNEL_DESTINATION_MANAGE,
    NotificationsPermissionEnum.CHANNEL_DESTINATION_READ,
  ],
  ADMIN: [
    NotificationsPermissionEnum.CHANNEL_DESTINATION_MANAGE,
    NotificationsPermissionEnum.CHANNEL_DESTINATION_READ,
  ],
  MEMBER: [NotificationsPermissionEnum.CHANNEL_DESTINATION_READ],
};

/**
 * Tenant-scoped authorization guard for the `notifications` context (D11).
 * Built via the kit's `createTenantPermissionGuard()` factory with no custom
 * `resolveTenantId` — its default already resolves REST's path `:tenantId`
 * and GraphQL's `input.tenantId`, matching this context's endpoints exactly.
 *
 * The factory's own `canActivate()` returns `true` when a guarded method
 * carries no `@RequiresTenantPermission(...)` metadata — see
 * `notifications-tenant-permission-guard.reflection.ts` for the check that
 * makes a missing decorator on a guarded method impossible to merge.
 */
export const NotificationsTenantPermissionGuard: Type<CanActivate> =
  createTenantPermissionGuard<NotificationsPermissionEnum>({
    rolePermissions: NOTIFICATIONS_ROLE_PERMISSIONS,
  });
