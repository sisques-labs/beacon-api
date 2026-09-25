export const SECRET_CIPHER_PORT = Symbol('SECRET_CIPHER_PORT');

/**
 * Context-scoped port over the core, context-agnostic AES-256-GCM cipher
 * (design.md D6). `encrypt`/`decrypt` round-trip the D4 envelope format
 * (`v{keyVersion}:{iv}:{authTag}:{ciphertext}`); `decrypt` throws when the
 * AAD, key version, or ciphertext integrity does not match (D3/D5).
 */
export interface ISecretCipherPort {
  encrypt(plaintext: string, aad: string): string;
  decrypt(envelope: string, aad: string): string;
}
