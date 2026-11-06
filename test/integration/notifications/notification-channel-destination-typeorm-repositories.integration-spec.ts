import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';

import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import {
  INotificationChannelDestinationReadRepository,
  NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import {
  INotificationChannelDestinationWriteRepository,
  NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationsModule } from '@contexts/notifications/notifications.module';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';

const ENVELOPE =
  'v1:aaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:Y2lwaGVydGV4dA';

function buildAggregate(overrides: {
  tenantId?: string;
  channel?: string;
  envelope?: string;
}) {
  return new NotificationChannelDestinationBuilder()
    .withId(randomUUID())
    .withTenantId(overrides.tenantId ?? randomUUID())
    .withChannel(overrides.channel ?? NotificationChannelEnum.DISCORD)
    .withEnvelope(overrides.envelope ?? ENVELOPE)
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('NotificationChannelDestination TypeORM repositories (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepository: INotificationChannelDestinationWriteRepository;
  let readRepository: INotificationChannelDestinationReadRepository;
  let ormRepository: Repository<NotificationChannelDestinationEntity>;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [NotificationsModule] });
    writeRepository = ctx.module.get(
      NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY,
    );
    readRepository = ctx.module.get(
      NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY,
    );
    ormRepository = ctx.module.get(
      getRepositoryToken(NotificationChannelDestinationEntity),
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ormRepository.query(
      'TRUNCATE "notification_channel_destinations" RESTART IDENTITY CASCADE',
    );
  });

  it('persists an aggregate and reads it back via the write repository, envelope intact', async () => {
    const aggregate = buildAggregate({});

    await writeRepository.save(aggregate);
    const found = await writeRepository.findById(aggregate.id.value);

    expect(found).not.toBeNull();
    expect(found?.tenantId.value).toBe(aggregate.tenantId.value);
    expect(found?.channel.value).toBe(aggregate.channel.value);
    expect(found?.envelope.value).toBe(ENVELOPE);
  });

  it('stores the envelope column as ciphertext, never the plaintext webhook URL', async () => {
    const aggregate = buildAggregate({});

    await writeRepository.save(aggregate);
    const row = await ormRepository.findOne({
      where: { id: aggregate.id.value },
    });

    expect(row?.encryptedAddress).toBe(ENVELOPE);
    expect(row?.encryptedAddress).not.toContain('discord.com');
    expect(row?.encryptedAddress).not.toContain('https://');
  });

  it('findByTenantAndChannel returns the aggregate for the same (tenantId, channel)', async () => {
    const tenantId = randomUUID();
    const aggregate = buildAggregate({
      tenantId,
      channel: NotificationChannelEnum.DISCORD,
    });

    await writeRepository.save(aggregate);
    const found = await writeRepository.findByTenantAndChannel(
      tenantId,
      NotificationChannelEnum.DISCORD,
    );

    expect(found).not.toBeNull();
    expect(found?.id.value).toBe(aggregate.id.value);
  });

  it('findByTenantAndChannel returns null when no destination matches', async () => {
    const found = await writeRepository.findByTenantAndChannel(
      randomUUID(),
      NotificationChannelEnum.DISCORD,
    );

    expect(found).toBeNull();
  });

  it('enforces the (tenantId, channel) unique index — a second insert is rejected (D12)', async () => {
    const tenantId = randomUUID();
    const first = buildAggregate({
      tenantId,
      channel: NotificationChannelEnum.DISCORD,
    });
    const second = buildAggregate({
      tenantId,
      channel: NotificationChannelEnum.DISCORD,
    });

    await writeRepository.save(first);

    await expect(writeRepository.save(second)).rejects.toBeInstanceOf(
      QueryFailedError,
    );
  });

  it('allows the same channel across different tenants', async () => {
    const first = buildAggregate({
      tenantId: randomUUID(),
      channel: NotificationChannelEnum.DISCORD,
    });
    const second = buildAggregate({
      tenantId: randomUUID(),
      channel: NotificationChannelEnum.DISCORD,
    });

    await writeRepository.save(first);

    await expect(writeRepository.save(second)).resolves.toBeDefined();
  });

  it('reads the persisted destination via the read repository as a metadata-only view model', async () => {
    const aggregate = buildAggregate({});

    await writeRepository.save(aggregate);
    const viewModel = await readRepository.findById(aggregate.id.value);

    expect(viewModel).not.toBeNull();
    expect(viewModel?.tenantId).toBe(aggregate.tenantId.value);
    expect(viewModel?.channel).toBe(aggregate.channel.value);
    expect(viewModel).not.toHaveProperty('envelope');
    expect(viewModel).not.toHaveProperty('encryptedAddress');
  });

  it('the read repository never selects encryptedAddress from the database (D10)', async () => {
    const aggregate = buildAggregate({});
    await writeRepository.save(aggregate);

    const raw: Array<Record<string, unknown>> = await ormRepository.query(
      `SELECT * FROM notification_channel_destinations WHERE id = $1`,
      [aggregate.id.value],
    );
    expect(raw[0]?.encryptedAddress).toBe(ENVELOPE);

    const entity = await readRepository.findById(aggregate.id.value);
    expect(entity).not.toBeNull();
    expect(JSON.stringify(entity)).not.toContain(ENVELOPE);
  });

  it("read repository's save leaves the envelope intact (metadata-only update, D10)", async () => {
    const aggregate = buildAggregate({});
    await writeRepository.save(aggregate);
    const viewModel = await readRepository.findById(aggregate.id.value);

    await readRepository.save(viewModel!);

    const stillFound = await writeRepository.findById(aggregate.id.value);
    expect(stillFound?.envelope.value).toBe(ENVELOPE);
  });
});
