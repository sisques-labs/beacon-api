import { Mocked, vi } from 'vitest';

import { ISecretCipherPort } from '@contexts/notifications/application/ports/secret-cipher.port';
import { EncryptChannelDestinationSecretService } from '@contexts/notifications/application/services/write/encrypt-channel-destination-secret/encrypt-channel-destination-secret.service';
import { ResolveNotificationDeliveryDestinationService } from '@contexts/notifications/application/services/write/resolve-notification-delivery-destination/resolve-notification-delivery-destination.service';
import { INotificationChannelDestinationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL = 'DISCORD';
const EXPECTED_AAD = `notifications:channel-destination:${TENANT_ID}:${CHANNEL}`;
const ENVELOPE = 'v1:iv:tag:ct';
const CANONICAL_URL =
  'https://discord.com/api/webhooks/123456789012345678/aValidToken';

function buildExistingDestination(envelope = ENVELOPE) {
  return { envelope: { value: envelope } } as never;
}

describe('ResolveNotificationDeliveryDestinationService', () => {
  let service: ResolveNotificationDeliveryDestinationService;
  let writeRepository: Mocked<INotificationChannelDestinationWriteRepository>;
  let secretCipherPort: Mocked<ISecretCipherPort>;
  let encryptService: Mocked<EncryptChannelDestinationSecretService>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationChannelDestinationWriteRepository>;
    secretCipherPort = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    };
    encryptService = {
      buildEncryptionContext: vi.fn().mockReturnValue(EXPECTED_AAD),
    } as unknown as Mocked<EncryptChannelDestinationSecretService>;
    service = new ResolveNotificationDeliveryDestinationService(
      writeRepository,
      secretCipherPort,
      encryptService,
    );
  });

  it('returns undefined when no destination is registered for the tenant/channel', async () => {
    writeRepository.findByCriteria.mockResolvedValue({ items: [] } as never);

    const result = await service.execute({
      tenantId: TENANT_ID,
      channel: CHANNEL,
    });

    expect(result).toBeUndefined();
    expect(secretCipherPort.decrypt).not.toHaveBeenCalled();
  });

  it('decrypts with AAD notifications:channel-destination:{tenantId}:{channel} (D5)', async () => {
    writeRepository.findByCriteria.mockResolvedValue({
      items: [buildExistingDestination()],
    } as never);
    secretCipherPort.decrypt.mockResolvedValue(CANONICAL_URL);

    await service.execute({ tenantId: TENANT_ID, channel: CHANNEL });

    expect(encryptService.buildEncryptionContext).toHaveBeenCalledWith(
      TENANT_ID,
      CHANNEL,
    );
    expect(secretCipherPort.decrypt).toHaveBeenCalledWith(
      ENVELOPE,
      EXPECTED_AAD,
    );
  });

  it('returns the decrypted url and a redacted logLabel when the destination is registered', async () => {
    writeRepository.findByCriteria.mockResolvedValue({
      items: [buildExistingDestination()],
    } as never);
    secretCipherPort.decrypt.mockResolvedValue(CANONICAL_URL);

    const result = await service.execute({
      tenantId: TENANT_ID,
      channel: CHANNEL,
    });

    expect(result).toEqual({
      url: CANONICAL_URL,
      logLabel: 'discord:webhook/123456789012345678',
    });
  });

  it('propagates a decrypt/AAD/tamper failure unchanged (D3)', async () => {
    writeRepository.findByCriteria.mockResolvedValue({
      items: [buildExistingDestination()],
    } as never);
    const decryptError = new Error(
      'Unsupported state or unable to authenticate data',
    );
    secretCipherPort.decrypt.mockRejectedValue(decryptError);

    await expect(
      service.execute({ tenantId: TENANT_ID, channel: CHANNEL }),
    ).rejects.toBe(decryptError);
  });

  it('throws when the decrypted value no longer passes URL re-validation', async () => {
    writeRepository.findByCriteria.mockResolvedValue({
      items: [buildExistingDestination()],
    } as never);
    secretCipherPort.decrypt.mockResolvedValue(
      'https://evil.example.com/not-discord',
    );

    await expect(
      service.execute({ tenantId: TENANT_ID, channel: CHANNEL }),
    ).rejects.toThrow();
  });
});
