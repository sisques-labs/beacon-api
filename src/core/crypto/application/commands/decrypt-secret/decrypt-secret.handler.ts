import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { DecryptSecretCommand } from '@core/crypto/application/commands/decrypt-secret/decrypt-secret.command';

/**
 * Delegates to `AesGcmCipherService`. Never logs the command payload; a
 * failure (tamper / AAD mismatch) propagates unchanged.
 */
@CommandHandler(DecryptSecretCommand)
export class DecryptSecretCommandHandler implements ICommandHandler<
  DecryptSecretCommand,
  string
> {
  constructor(private readonly cipherService: AesGcmCipherService) {}

  async execute(command: DecryptSecretCommand): Promise<string> {
    return this.cipherService.decrypt(command.envelope, command.aad);
  }
}
