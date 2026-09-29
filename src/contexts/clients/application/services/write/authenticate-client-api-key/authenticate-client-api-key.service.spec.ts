import { Logger } from '@nestjs/common';
import { Mocked, vi } from 'vitest';

import { IApiKeyHasherPort } from '@contexts/clients/application/ports/api-key-hasher.port';
import { AuthenticateClientApiKeyService } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticate-client-api-key.service';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import { IClientWriteRepository } from '@contexts/clients/domain/repositories/write/client-write.repository';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const KEY_ID = 'aaaaaaaaaaaaaaaa';
const SECRET = 'b'.repeat(43);
const VALID_KEY = `bcn_${KEY_ID}_${SECRET}`;
const STORED_HASH = 'c'.repeat(64);
const MATCHING_HASH = STORED_HASH;
const MISMATCHED_HASH = 'd'.repeat(64);

function buildClient(revoked = false): ReturnType<ClientBuilder['build']> {
  const now = new Date();
  const builder = new ClientBuilder()
    .withId(CLIENT_ID)
    .withTenantId(TENANT_ID)
    .withName('Acme Corp')
    .withApiKeyId(KEY_ID)
    .withApiKeySecretHash(STORED_HASH)
    .withCreatedAt(now)
    .withUpdatedAt(now);
  if (revoked) builder.withRevokedAt(now);
  return builder.build();
}

describe('AuthenticateClientApiKeyService', () => {
  let service: AuthenticateClientApiKeyService;
  let writeRepository: Mocked<IClientWriteRepository>;
  let apiKeyHasherPort: Mocked<IApiKeyHasherPort>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByApiKeyId: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<IClientWriteRepository>;
    apiKeyHasherPort = { hash: vi.fn() };
    service = new AuthenticateClientApiKeyService(
      writeRepository,
      apiKeyHasherPort,
    );
  });

  it.each([
    ['undefined credential', undefined],
    ['empty string', ''],
    ['missing prefix', `${KEY_ID}_${SECRET}`],
    ['short keyId', `bcn_${'a'.repeat(15)}_${SECRET}`],
    ['uppercase-hex keyId', `bcn_${'A'.repeat(16)}_${SECRET}`],
    ['short secret', `bcn_${KEY_ID}_${'b'.repeat(42)}`],
    ['secret with invalid char', `bcn_${KEY_ID}_${'!'.repeat(43)}`],
  ])(
    'returns null for a malformed key (%s) without hitting the repository',
    async (_label, credential) => {
      const result = await service.execute(credential);

      expect(result).toBeNull();
      expect(writeRepository.findByApiKeyId).not.toHaveBeenCalled();
      expect(apiKeyHasherPort.hash).not.toHaveBeenCalled();
    },
  );

  it('returns null for an unknown keyId, but still runs the dummy compare (D17)', async () => {
    writeRepository.findByApiKeyId.mockResolvedValue(null);
    apiKeyHasherPort.hash.mockReturnValue(MISMATCHED_HASH);

    const result = await service.execute(VALID_KEY);

    expect(result).toBeNull();
    expect(writeRepository.findByApiKeyId).toHaveBeenCalledWith(KEY_ID);
    expect(apiKeyHasherPort.hash).toHaveBeenCalledWith(SECRET);
  });

  it('returns null when the secret does not match the stored hash', async () => {
    writeRepository.findByApiKeyId.mockResolvedValue(buildClient());
    apiKeyHasherPort.hash.mockReturnValue(MISMATCHED_HASH);

    const result = await service.execute(VALID_KEY);

    expect(result).toBeNull();
  });

  it('returns null when the client is revoked, even with a matching secret', async () => {
    writeRepository.findByApiKeyId.mockResolvedValue(buildClient(true));
    apiKeyHasherPort.hash.mockReturnValue(MATCHING_HASH);

    const result = await service.execute(VALID_KEY);

    expect(result).toBeNull();
  });

  it('resolves the clientId and tenantId for a valid, unrevoked key', async () => {
    writeRepository.findByApiKeyId.mockResolvedValue(buildClient());
    apiKeyHasherPort.hash.mockReturnValue(MATCHING_HASH);

    const result = await service.execute(VALID_KEY);

    expect(result).toEqual({ clientId: CLIENT_ID, tenantId: TENANT_ID });
  });

  it('never logs the presented key or secret on any path', async () => {
    writeRepository.findByApiKeyId.mockResolvedValue(buildClient());
    apiKeyHasherPort.hash.mockReturnValue(MISMATCHED_HASH);
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.execute(VALID_KEY);
    await service.execute(undefined);

    const loggedCalls = [
      ...logSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...warnSpy.mock.calls,
    ].flat();
    for (const call of loggedCalls) {
      const serialized = typeof call === 'string' ? call : JSON.stringify(call);
      expect(serialized).not.toContain(VALID_KEY);
      expect(serialized).not.toContain(SECRET);
    }

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
