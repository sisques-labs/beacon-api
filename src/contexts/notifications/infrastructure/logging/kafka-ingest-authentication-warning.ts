/**
 * Phase B Kafka authentication drop warning (design.md D23). Built once the
 * consumer already knows `IClientAuthenticationPort.authenticate()` returned
 * `null` — a missing, invalid, or revoked credential all collapse to the
 * same `null` at the port boundary (design.md D17's enumeration mitigation),
 * so this warning only distinguishes "no header presented" from "a header
 * was presented but rejected". The `keyId` prefix of the `bcn_` format is
 * public by design (D16 — "the prefix lets secret scanners find leaked
 * keys"), so parsing it out for a log line is safe; the full credential is
 * never read or logged here.
 */

const API_KEY_FORMAT = /^bcn_([0-9a-f]{16})_[A-Za-z0-9_-]{43}$/;

/** Extracts the public `keyId` segment for logging only — never used to authenticate. */
export function parseApiKeyIdForLogging(
  credential: string | undefined,
): string | undefined {
  return credential?.match(API_KEY_FORMAT)?.[1];
}

export function buildIngestAuthenticationRejectedWarning(params: {
  credential: string | undefined;
  topic: string;
  partition: number;
}): string {
  const { credential, topic, partition } = params;
  const reason = credential
    ? 'invalid or revoked x-api-key'
    : 'missing x-api-key header';
  const keyId = parseApiKeyIdForLogging(credential);
  const keyIdSuffix = keyId ? `, keyId=${keyId}` : '';

  return `Dropping notification-request message on "${topic}" (partition=${partition}): ${reason}${keyIdSuffix}`;
}
