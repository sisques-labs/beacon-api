import { Mocked, vi } from 'vitest';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { EncryptSecretCommand } from '@core/crypto/application/commands/encrypt-secret/encrypt-secret.command';
import { EncryptSecretCommandHandler } from '@core/crypto/application/commands/encrypt-secret/encrypt-secret.handler';

describe('EncryptSecretCommandHandler', () => {
  let handler: EncryptSecretCommandHandler;
  let cipherService: Mocked<AesGcmCipherService>;

  beforeEach(() => {
    cipherService = {
      encrypt: vi.fn(),
    } as unknown as Mocked<AesGcmCipherService>;
    handler = new EncryptSecretCommandHandler(cipherService);
  });

  it('delegates to AesGcmCipherService.encrypt and returns the envelope', async () => {
    cipherService.encrypt.mockReturnValue('v1:iv:tag:ct');

    const result = await handler.execute(
      new EncryptSecretCommand({ plaintext: 'secret', aad: 'aad-1' }),
    );

    expect(cipherService.encrypt).toHaveBeenCalledWith('secret', 'aad-1');
    expect(result).toBe('v1:iv:tag:ct');
  });
});
