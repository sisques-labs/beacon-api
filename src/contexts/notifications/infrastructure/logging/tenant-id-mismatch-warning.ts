import { Logger } from '@nestjs/common';

/**
 * Phase B mismatch warning (design.md D22). The request body/input
 * `tenantId` is deprecated and MUST NEVER be used to select the creation
 * tenant — creation always uses the authenticated client's own tenant
 * (`@CurrentClient()`). When a caller still sends a body `tenantId` that
 * differs from the authenticated tenant, log a warning noting the mismatch
 * (never the API key) so ops has a signal for stale/incorrect SDK usage,
 * without ever affecting which tenant the notification is created for.
 */
export function warnIfTenantIdMismatch(
  logger: Logger,
  bodyTenantId: string | undefined,
  authenticatedTenantId: string,
): void {
  if (!bodyTenantId || bodyTenantId === authenticatedTenantId) return;
  logger.warn(
    `Ignoring mismatched body tenantId ${bodyTenantId} — creating for authenticated tenant ${authenticatedTenantId} instead`,
  );
}
