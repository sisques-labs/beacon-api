/**
 * Result of generating a new API key (design.md D16). `key` is the full
 * `bcn_{keyId}_{secret}` string, printed to the caller exactly once and
 * never persisted. `keyId` and `secret` are the same two values split out
 * so a caller can persist `keyId` for lookup and hash `secret` without
 * re-parsing `key`.
 */
export interface IGeneratedApiKey {
  key: string;
  keyId: string;
  secret: string;
}
