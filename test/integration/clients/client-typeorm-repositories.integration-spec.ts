import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';

import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import {
  CLIENT_READ_REPOSITORY,
  IClientReadRepository,
} from '@contexts/clients/domain/repositories/read/client-read.repository';
import {
  CLIENT_WRITE_REPOSITORY,
  IClientWriteRepository,
} from '@contexts/clients/domain/repositories/write/client-write.repository';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';
import { ClientTypeormReadRepository } from '@contexts/clients/infrastructure/persistence/typeorm/repositories/client-typeorm-read.repository';
import { ClientTypeormWriteRepository } from '@contexts/clients/infrastructure/persistence/typeorm/repositories/client-typeorm-write.repository';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';

const HASH = 'a'.repeat(64);
// A base64url-shaped plaintext secret — never what gets stored (D17).
const PLAINTEXT_SECRET = 'b'.repeat(43);

function randomApiKeyId(): string {
  return randomBytes(8).toString('hex');
}

function buildAggregate(overrides: {
  tenantId?: string;
  apiKeyId?: string;
  apiKeySecretHash?: string;
  revokedAt?: Date | null;
}) {
  return new ClientBuilder()
    .withId(randomUUID())
    .withTenantId(overrides.tenantId ?? randomUUID())
    .withName('Acme Corp')
    .withApiKeyId(overrides.apiKeyId ?? randomApiKeyId())
    .withApiKeySecretHash(overrides.apiKeySecretHash ?? HASH)
    .withApiKeyRotatedAt(null)
    .withRevokedAt(overrides.revokedAt ?? null)
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('Client TypeORM repositories (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepository: IClientWriteRepository;
  let readRepository: IClientReadRepository;
  let ormRepository: Repository<ClientEntity>;

  beforeAll(async () => {
    ctx = await createIntegrationModule({
      imports: [TypeOrmModule.forFeature([ClientEntity])],
      providers: [
        ClientTypeormMapper,
        {
          provide: CLIENT_WRITE_REPOSITORY,
          useClass: ClientTypeormWriteRepository,
        },
        {
          provide: CLIENT_READ_REPOSITORY,
          useClass: ClientTypeormReadRepository,
        },
      ],
    });
    writeRepository = ctx.module.get(CLIENT_WRITE_REPOSITORY);
    readRepository = ctx.module.get(CLIENT_READ_REPOSITORY);
    ormRepository = ctx.module.get(getRepositoryToken(ClientEntity));
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ormRepository.query('TRUNCATE "clients" RESTART IDENTITY CASCADE');
  });

  it('enforces uniqueness of apiKeyId — a second client with the same apiKeyId is rejected', async () => {
    const apiKeyId = randomApiKeyId();
    const first = buildAggregate({ apiKeyId });
    const second = buildAggregate({ apiKeyId });

    await writeRepository.save(first);

    await expect(writeRepository.save(second)).rejects.toBeInstanceOf(
      QueryFailedError,
    );
  });

  it('rejects a second active client for the same tenant (partial active-tenantId index, D19)', async () => {
    const tenantId = randomUUID();
    const first = buildAggregate({ tenantId });
    const second = buildAggregate({ tenantId });

    await writeRepository.save(first);

    await expect(writeRepository.save(second)).rejects.toBeInstanceOf(
      QueryFailedError,
    );
  });

  it('allows a new client to be created for the same tenant after the prior one is revoked', async () => {
    const tenantId = randomUUID();
    const first = buildAggregate({ tenantId });
    await writeRepository.save(first);

    first.revoke();
    await writeRepository.save(first);

    const reissued = buildAggregate({ tenantId });

    await expect(writeRepository.save(reissued)).resolves.toBeDefined();
  });

  it('findByApiKeyId resolves the client for a stored apiKeyId', async () => {
    const apiKeyId = randomApiKeyId();
    const aggregate = buildAggregate({ apiKeyId });
    await writeRepository.save(aggregate);

    const found = await writeRepository.findByApiKeyId(apiKeyId);

    expect(found).not.toBeNull();
    expect(found?.id.value).toBe(aggregate.id.value);
    expect(found?.apiKeyId.value).toBe(apiKeyId);
  });

  it('findByApiKeyId returns null when no client matches', async () => {
    const found = await writeRepository.findByApiKeyId(randomApiKeyId());

    expect(found).toBeNull();
  });

  it('stores only the hash, never the plaintext secret (D17)', async () => {
    const aggregate = buildAggregate({ apiKeySecretHash: HASH });
    await writeRepository.save(aggregate);

    const row = await ormRepository.findOne({
      where: { id: aggregate.id.value },
    });

    expect(row?.apiKeySecretHash).toBe(HASH);
    expect(row?.apiKeySecretHash).not.toBe(PLAINTEXT_SECRET);
    expect(row?.apiKeySecretHash).not.toContain(PLAINTEXT_SECRET);
  });

  it('the read repository never selects apiKeySecretHash from the database, though the column holds real data (D17, mirrors D10)', async () => {
    const aggregate = buildAggregate({ apiKeySecretHash: HASH });
    await writeRepository.save(aggregate);

    const raw: Array<Record<string, unknown>> = await ormRepository.query(
      `SELECT * FROM clients WHERE id = $1`,
      [aggregate.id.value],
    );
    expect(raw[0]?.apiKeySecretHash).toBe(HASH);

    const viewModel = await readRepository.findById(aggregate.id.value);
    expect(viewModel).not.toBeNull();
    expect(viewModel).not.toHaveProperty('apiKeySecretHash');
    expect(JSON.stringify(viewModel)).not.toContain(HASH);
  });

  it("read repository's save leaves the hash intact (metadata-only update, D17)", async () => {
    const aggregate = buildAggregate({ apiKeySecretHash: HASH });
    await writeRepository.save(aggregate);
    const viewModel = await readRepository.findById(aggregate.id.value);

    await readRepository.save(viewModel!);

    const stillFound = await writeRepository.findById(aggregate.id.value);
    expect(stillFound?.apiKeySecretHash.value).toBe(HASH);
  });
});
