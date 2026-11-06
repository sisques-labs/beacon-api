export interface EncryptSecretCommandInput {
  plaintext: string;
  aad: string;
}

/**
 * Context-agnostic request to encrypt a secret (design.md D6). Carries only
 * primitives so any bounded context can dispatch it through the `CommandBus`
 * without depending on `@core/crypto` internals. Resolves to the D4 envelope
 * string. `plaintext` is sensitive: never log or serialise this command.
 */
export class EncryptSecretCommand {
  public readonly plaintext: string;
  public readonly aad: string;

  constructor(input: EncryptSecretCommandInput) {
    this.plaintext = input.plaintext;
    this.aad = input.aad;
  }
}
