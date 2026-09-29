import { CommandBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { DecryptSecretCommand } from '@core/crypto/application/commands/decrypt-secret/decrypt-secret.command';
import { EncryptSecretCommand } from '@core/crypto/application/commands/encrypt-secret/encrypt-secret.command';
import { AesGcmSecretCipherAdapter } from '@contexts/notifications/infrastructure/adapters/aes-gcm-secret-cipher.adapter';

const URL_SECRET =
  'https://discord.com/api/webhooks/123456789012345678/aValidToken';
const AAD = 'notifications:channel-destination:tenant-1:DISCORD';

describe('AesGcmSecretCipherAdapter', () => {
  let adapter: AesGcmSecretCipherAdapter;
  let commandBus: Mocked<CommandBus>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    adapter = new AesGcmSecretCipherAdapter(commandBus);
  });

  it('dispatches EncryptSecretCommand and returns the envelope', async () => {
    commandBus.execute.mockResolvedValue('v1:iv:tag:ct');

    const result = await adapter.encrypt(URL_SECRET, AAD);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0];
    expect(command).toBeInstanceOf(EncryptSecretCommand);
    expect(command).toMatchObject({ plaintext: URL_SECRET, aad: AAD });
    expect(result).toBe('v1:iv:tag:ct');
  });

  it('dispatches DecryptSecretCommand and returns the plaintext', async () => {
    commandBus.execute.mockResolvedValue(URL_SECRET);

    const result = await adapter.decrypt('v1:iv:tag:ct', AAD);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0];
    expect(command).toBeInstanceOf(DecryptSecretCommand);
    expect(command).toMatchObject({ envelope: 'v1:iv:tag:ct', aad: AAD });
    expect(result).toBe(URL_SECRET);
  });

  it('propagates a decrypt failure (tamper/AAD mismatch) unchanged', async () => {
    const tamperError = new Error(
      'Unsupported state or unable to authenticate data',
    );
    commandBus.execute.mockRejectedValue(tamperError);

    await expect(adapter.decrypt('v1:iv:tag:ct', 'wrong-aad')).rejects.toBe(
      tamperError,
    );
  });
});
