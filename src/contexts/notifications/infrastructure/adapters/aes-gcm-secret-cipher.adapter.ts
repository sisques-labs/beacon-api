import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

// Shared-kernel contract: the command classes are the only `@core/crypto`
// symbols this context may import. Never import the cipher service, module
// or handlers.
import { DecryptSecretCommand } from '@core/crypto/application/commands/decrypt-secret/decrypt-secret.command';
import { EncryptSecretCommand } from '@core/crypto/application/commands/encrypt-secret/encrypt-secret.command';
import { ISecretCipherPort } from '@contexts/notifications/application/ports/secret-cipher.port';

/**
 * Thin `notifications`-scoped adapter that dispatches the core, context-agnostic
 * `EncryptSecretCommand` / `DecryptSecretCommand` through the `CommandBus`
 * (design.md D6). Keeps the boundaries: the domain/application layers depend
 * on `ISecretCipherPort`, never on `@core/crypto` services.
 */
@Injectable()
export class AesGcmSecretCipherAdapter implements ISecretCipherPort {
  constructor(private readonly commandBus: CommandBus) {}

  encrypt(plaintext: string, aad: string): Promise<string> {
    return this.commandBus.execute(
      new EncryptSecretCommand({ plaintext, aad }),
    );
  }

  decrypt(envelope: string, aad: string): Promise<string> {
    return this.commandBus.execute(new DecryptSecretCommand({ envelope, aad }));
  }
}
