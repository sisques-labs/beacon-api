import { Mocked, vi } from 'vitest';

import { ISecretCipherPort } from '@contexts/notifications/application/ports/secret-cipher.port';
import { EncryptChannelDestinationSecretService } from '@contexts/notifications/application/services/write/encrypt-channel-destination-secret/encrypt-channel-destination-secret.service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

describe('EncryptChannelDestinationSecretService', () => {
  let service: EncryptChannelDestinationSecretService;
  let secretCipherPort: Mocked<ISecretCipherPort>;

  beforeEach(() => {
    secretCipherPort = {
      encrypt: vi.fn().mockResolvedValue('v1:iv:tag:ct'),
      decrypt: vi.fn(),
    };
    service = new EncryptChannelDestinationSecretService(secretCipherPort);
  });

  it('builds the encryption context as notifications:channel-destination:{tenantId}:{channel}', () => {
    expect(service.buildEncryptionContext(TENANT_ID, 'DISCORD')).toBe(
      `notifications:channel-destination:${TENANT_ID}:DISCORD`,
    );
  });

  it('encrypts the plaintext bound to the encryption context and returns the awaited envelope', async () => {
    const result = await service.execute({
      tenantId: TENANT_ID,
      channel: 'DISCORD',
      plaintext: 'https://discord.com/api/webhooks/1/token',
    });

    expect(result).toBe('v1:iv:tag:ct');
    expect(secretCipherPort.encrypt).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/1/token',
      `notifications:channel-destination:${TENANT_ID}:DISCORD`,
    );
  });

  it('propagates cipher failures', async () => {
    const failure = new Error('kms down');
    secretCipherPort.encrypt.mockRejectedValue(failure);

    await expect(
      service.execute({
        tenantId: TENANT_ID,
        channel: 'DISCORD',
        plaintext: 'x',
      }),
    ).rejects.toBe(failure);
  });
});
