/**
 * `apiKey` is the full plaintext key (design.md D16), returned exactly
 * once so the caller (the CLI runner, Phase 19) can print it and never
 * persist or log it again. Rotation does not return `id`/`tenantId` —
 * the caller already has `clientId` from the command input.
 */
export interface RotateClientApiKeyResult {
  apiKey: string;
}
