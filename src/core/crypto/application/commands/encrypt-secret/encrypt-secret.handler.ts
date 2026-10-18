import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { EncryptSecretCommand } from '@core/crypto/application/commands/encrypt-secret/encrypt-secret.command';

/**
 * Delegates to `AesGcmCipherService`. Never logs the command payload.
 */
@CommandHandler(EncryptSecretCommand)
export class EncryptSecretCommandHandler implements ICommandHandler<
  EncryptSecretCommand,
  string
> {
  constructor(private readonly cipherService: AesGcmCipherService) {}

  async execute(command: EncryptSecretCommand): Promise<string> {
    return this.cipherService.encrypt(command.plaintext, command.aad);
  }
}
