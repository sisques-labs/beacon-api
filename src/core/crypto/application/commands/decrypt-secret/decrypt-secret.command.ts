export interface DecryptSecretCommandInput {
  envelope: string;
  aad: string;
}

/**
 * Context-agnostic request to decrypt a secret envelope (design.md D6).
 * Carries only primitives so any bounded context can dispatch it through the
 * `CommandBus`. Resolves to the plaintext; rejects when the AAD, key version
 * or ciphertext integrity does not match. The envelope is sensitive: never
 * log or serialise this command.
 */
export class DecryptSecretCommand {
  public readonly envelope: string;
  public readonly aad: string;

  constructor(input: DecryptSecretCommandInput) {
    this.envelope = input.envelope;
    this.aad = input.aad;
  }
}
