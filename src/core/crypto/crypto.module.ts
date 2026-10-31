import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { DecryptSecretCommandHandler } from '@core/crypto/application/commands/decrypt-secret/decrypt-secret.handler';
import { EncryptSecretCommandHandler } from '@core/crypto/application/commands/encrypt-secret/encrypt-secret.handler';

const COMMAND_HANDLERS = [
  EncryptSecretCommandHandler,
  DecryptSecretCommandHandler,
];

/**
 * Context-agnostic encryption primitives (design.md D6). Bounded contexts
 * MUST NOT inject `AesGcmCipherService` (or import this module's internals)
 * directly: they dispatch `EncryptSecretCommand` / `DecryptSecretCommand`
 * through the `CommandBus`, behind their own port (e.g. `ISecretCipherPort`
 * in `notifications/application/ports/`). The service stays an internal
 * provider of this module and is not exported.
 */
@Global()
@Module({
  imports: [CqrsModule],
  providers: [AesGcmCipherService, ...COMMAND_HANDLERS],
})
export class CryptoModule {}
