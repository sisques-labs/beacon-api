import { Global, Module } from '@nestjs/common';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';

/**
 * Context-agnostic encryption primitives (design.md D6). `@Global` so every
 * bounded context can inject `AesGcmCipherService` without re-importing this
 * module — mirrors `ConfigModule`'s `isGlobal: true` wiring in
 * `core.module.ts`. A context still MUST NOT depend on this service
 * directly outside its own port/adapter boundary — see
 * `ISecretCipherPort` in `notifications/application/ports/`.
 */
@Global()
@Module({
  providers: [AesGcmCipherService],
  exports: [AesGcmCipherService],
})
export class CryptoModule {}
