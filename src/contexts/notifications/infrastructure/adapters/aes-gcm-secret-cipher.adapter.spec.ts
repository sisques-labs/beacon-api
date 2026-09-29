import { Mocked, vi } from 'vitest';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { AesGcmSecretCipherAdapter } from '@contexts/notifications/infrastructure/adapters/aes-gcm-secret-cipher.adapter';

describe('AesGcmSecretCipherAdapter', () => {
  let adapter: AesGcmSecretCipherAdapter;
  let cipherService: Mocked<AesGcmCipherService>;

  beforeEach(() => {
    cipherService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    } as unknown as Mocked<AesGcmCipherService>;
    adapter = new AesGcmSecretCipherAdapter(cipherService);
  });

  it('delegates encrypt to the core AesGcmCipherService', () => {
    cipherService.encrypt.mockReturnValue('v1:iv:tag:ct');

    const result = adapter.encrypt(
      'https://discord.com/api/webhooks/123456789012345678/aValidToken',
      'notifications:channel-destination:tenant-1:DISCORD',
    );

    expect(cipherService.encrypt).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123456789012345678/aValidToken',
      'notifications:channel-destination:tenant-1:DISCORD',
    );
    expect(result).toBe('v1:iv:tag:ct');
  });

  it('delegates decrypt to the core AesGcmCipherService', () => {
    cipherService.decrypt.mockReturnValue(
      'https://discord.com/api/webhooks/123456789012345678/aValidToken',
    );

    const result = adapter.decrypt(
      'v1:iv:tag:ct',
      'notifications:channel-destination:tenant-1:DISCORD',
    );

    expect(cipherService.decrypt).toHaveBeenCalledWith(
      'v1:iv:tag:ct',
      'notifications:channel-destination:tenant-1:DISCORD',
    );
    expect(result).toBe(
      'https://discord.com/api/webhooks/123456789012345678/aValidToken',
    );
  });

  it('propagates a decrypt failure (tamper/AAD mismatch) unchanged', () => {
    const tamperError = new Error(
      'Unsupported state or unable to authenticate data',
    );
    cipherService.decrypt.mockImplementation(() => {
      throw tamperError;
    });

    expect(() => adapter.decrypt('v1:iv:tag:ct', 'wrong-aad')).toThrow(
      tamperError,
    );
  });
});
