export interface ICryptoConfig {
  /** Key used by `encrypt()`, identified by `keyVersion`. */
  key: Buffer;
  keyVersion: number;
  /**
   * Retired keys still needed to `decrypt()` older envelopes, indexed by
   * their key version. Never contains `keyVersion`.
   */
  previousKeys: ReadonlyMap<number, Buffer>;
}
