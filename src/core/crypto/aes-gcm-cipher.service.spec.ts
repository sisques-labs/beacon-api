import { ConfigService } from '@nestjs/config';
import { Mocked, vi } from 'vitest';

import { ICryptoConfig } from '@core/config/interfaces/crypto-config.interface';
import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';

const AAD = 'notifications:channel-destination:tenant-1:DISCORD';
const PLAINTEXT = 'https://discord.com/api/webhooks/111111111111111111/token';

function buildConfigService(
  overrides: Partial<ICryptoConfig> = {},
): Mocked<ConfigService> {
  const config: ICryptoConfig = {
    key: Buffer.alloc(32, 7),
    keyVersion: 1,
    ...overrides,
  };

  return {
    getOrThrow: vi.fn().mockReturnValue(config),
  } as unknown as Mocked<ConfigService>;
}

function tamperEnvelopePart(envelope: string, partIndex: number): string {
  const parts = envelope.split(':');
  const original = parts[partIndex];
  const flippedChar = original.at(0) === 'A' ? 'B' : 'A';

  parts[partIndex] = `${flippedChar}${original.slice(1)}`;

  return parts.join(':');
}

describe('AesGcmCipherService', () => {
  it('round-trips a plaintext through encrypt then decrypt', () => {
    const service = new AesGcmCipherService(buildConfigService());

    const envelope = service.encrypt(PLAINTEXT, AAD);

    expect(envelope).not.toContain(PLAINTEXT);
    expect(service.decrypt(envelope, AAD)).toBe(PLAINTEXT);
  });

  it('uses a fresh IV on every encrypt call, even for the same plaintext', () => {
    const service = new AesGcmCipherService(buildConfigService());

    const first = service.encrypt(PLAINTEXT, AAD);
    const second = service.encrypt(PLAINTEXT, AAD);

    expect(first).not.toBe(second);
    expect(first.split(':')[1]).not.toBe(second.split(':')[1]);
  });

  it('formats the envelope as v{keyVersion}:{iv}:{authTag}:{ciphertext}', () => {
    const service = new AesGcmCipherService(
      buildConfigService({
        keyVersion: 3,
      }),
    );

    const envelope = service.encrypt(PLAINTEXT, AAD);
    const parts = envelope.split(':');

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v3');
  });

  it('throws when the ciphertext part is tampered', () => {
    const service = new AesGcmCipherService(buildConfigService());
    const envelope = service.encrypt(PLAINTEXT, AAD);
    const tampered = tamperEnvelopePart(envelope, 3);

    expect(() => service.decrypt(tampered, AAD)).toThrow();
  });

  it('throws when the auth tag part is tampered', () => {
    const service = new AesGcmCipherService(buildConfigService());
    const envelope = service.encrypt(PLAINTEXT, AAD);
    const tampered = tamperEnvelopePart(envelope, 2);

    expect(() => service.decrypt(tampered, AAD)).toThrow();
  });

  it('throws when the IV part is tampered', () => {
    const service = new AesGcmCipherService(buildConfigService());
    const envelope = service.encrypt(PLAINTEXT, AAD);
    const tampered = tamperEnvelopePart(envelope, 1);

    expect(() => service.decrypt(tampered, AAD)).toThrow();
  });

  it('throws when the AAD does not match at decrypt time', () => {
    const service = new AesGcmCipherService(buildConfigService());
    const envelope = service.encrypt(PLAINTEXT, AAD);

    expect(() =>
      service.decrypt(
        envelope,
        'notifications:channel-destination:tenant-2:DISCORD',
      ),
    ).toThrow();
  });

  it('throws on an unknown envelope key version', () => {
    const service = new AesGcmCipherService(
      buildConfigService({
        keyVersion: 1,
      }),
    );
    const envelope = service.encrypt(PLAINTEXT, AAD);
    const [, iv, tag, ciphertext] = envelope.split(':');
    const unknownVersionEnvelope = ['v2', iv, tag, ciphertext].join(':');

    expect(() => service.decrypt(unknownVersionEnvelope, AAD)).toThrow(
      /unknown.*key version/i,
    );
  });

  it('throws when the configured key is not 32 bytes', () => {
    const service = new AesGcmCipherService(
      buildConfigService({
        key: Buffer.alloc(16, 1),
      }),
    );

    expect(() => service.encrypt(PLAINTEXT, AAD)).toThrow();
  });
});
