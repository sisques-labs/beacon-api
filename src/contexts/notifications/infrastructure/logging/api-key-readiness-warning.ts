import { Logger } from '@nestjs/common';

const API_KEY_HEADER = 'x-api-key';

/**
 * Phase A readiness warning (design.md Migration/Rollout D13). Logs once
 * whenever an unguarded call site (notification creation, ingestion, or
 * findById) is reached without an `x-api-key` header, so ops can see which
 * tenants still need a key issued before Phase B enforcement begins.
 * Behavior at the call site is otherwise unchanged. Never logs the
 * presented key, only whether one was presented.
 */
export function warnIfApiKeyMissing(
  logger: Logger,
  apiKey: string | undefined,
  tenantId?: string,
): void {
  if (apiKey) return;
  const suffix = tenantId ? ` for tenant ${tenantId}` : '';
  logger.warn(
    `No ${API_KEY_HEADER} header presented${suffix} — issue one with \`client:create\` before Phase B enforcement begins`,
  );
}

/**
 * Reads the `x-api-key` header value from an HTTP-shaped header map
 * (Express `Request.headers` or a plain inbound Kafka message's headers),
 * taking the first value when Express reports it as an array.
 */
export function readApiKeyHeaderValue(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const rawValue = headers[API_KEY_HEADER];
  return Array.isArray(rawValue) ? rawValue[0] : rawValue;
}
