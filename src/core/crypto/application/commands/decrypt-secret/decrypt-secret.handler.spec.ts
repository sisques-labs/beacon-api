import { Mocked, vi } from 'vitest';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { DecryptSecretCommand } from '@core/crypto/application/commands/decrypt-secret/decrypt-secret.command';
import { DecryptSecretCommandHandler } from '@core/crypto/application/commands/decrypt-secret/decrypt-secret.handler';

describe('DecryptSecretCommandHandler', () => {
  let handler: DecryptSecretCommandHandler;
  let cipherService: Mocked<AesGcmCipherService>;

  beforeEach(() => {
    cipherService = {
      decrypt: vi.fn(),
    } as unknown as Mocked<AesGcmCipherService>;
    handler = new DecryptSecretCommandHandler(cipherService);
  });

  it('delegates to AesGcmCipherService.decrypt and returns the plaintext', async () => {
    cipherService.decrypt.mockReturnValue('secret');

    const result = await handler.execute(
      new DecryptSecretCommand({ envelope: 'v1:iv:tag:ct', aad: 'aad-1' }),
    );

    expect(cipherService.decrypt).toHaveBeenCalledWith('v1:iv:tag:ct', 'aad-1');
    expect(result).toBe('secret');
  });

  it('propagates a decrypt failure unchanged', async () => {
    const tamperError = new Error(
      'Unsupported state or unable to authenticate data',
    );
    cipherService.decrypt.mockImplementation(() => {
      throw tamperError;
    });

    await expect(
      handler.execute(
        new DecryptSecretCommand({ envelope: 'v1:iv:tag:ct', aad: 'wrong' }),
      ),
    ).rejects.toBe(tamperError);
  });
});
