export const API_KEY_HASHER_PORT = Symbol('API_KEY_HASHER_PORT');

/**
 * Hashes an API key secret for storage/lookup (design.md D17). `hash` is a
 * pure, deterministic digest — it does not compare or verify. Constant-time
 * comparison against a stored (or dummy) hash is the caller's
 * responsibility, via `crypto.timingSafeEqual` in
 * `AuthenticateClientApiKeyService` (Phase 17), never here.
 */
export interface IApiKeyHasherPort {
  hash(secret: string): string;
}
