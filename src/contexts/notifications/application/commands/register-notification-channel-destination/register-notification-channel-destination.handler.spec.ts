import { EventBus } from '@nestjs/cqrs';
import { QueryFailedError } from 'typeorm';
import { Mocked, vi } from 'vitest';

import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { RegisterNotificationChannelDestinationCommandHandler } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.handler';
import { ISecretCipherPort } from '@contexts/notifications/application/ports/secret-cipher.port';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { INotificationChannelDestinationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';

const VALID_INPUT = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  channel: NotificationChannelEnum.DISCORD,
  webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/aValidToken',
};

const EXPECTED_AAD = `notifications:channel-destination:${VALID_INPUT.tenantId}:${NotificationChannelEnum.DISCORD}`;
const ENVELOPE = 'v1:iv:tag:ct';

function buildUniqueViolation(): QueryFailedError {
  const driverError = { code: '23505' };
  return new QueryFailedError('INSERT', [], driverError as unknown as Error);
}

describe('RegisterNotificationChannelDestinationCommandHandler', () => {
  let handler: RegisterNotificationChannelDestinationCommandHandler;
  let writeRepository: Mocked<INotificationChannelDestinationWriteRepository>;
  let secretCipherPort: Mocked<ISecretCipherPort>;
  let eventBus: Mocked<EventBus>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByTenantAndChannel: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationChannelDestinationWriteRepository>;
    secretCipherPort = {
      encrypt: vi.fn().mockReturnValue(ENVELOPE),
      decrypt: vi.fn(),
    };
    eventBus = { publishAll: vi.fn() } as unknown as Mocked<EventBus>;
    handler = new RegisterNotificationChannelDestinationCommandHandler(
      writeRepository,
      secretCipherPort,
      eventBus,
    );
  });

  it('encrypts with AAD notifications:channel-destination:{tenantId}:{channel} (D5)', async () => {
    writeRepository.findByTenantAndChannel.mockResolvedValue(null);
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    expect(secretCipherPort.encrypt).toHaveBeenCalledWith(
      VALID_INPUT.webhookUrl,
      EXPECTED_AAD,
    );
  });

  it('creates a new destination and emits register() when none exists', async () => {
    writeRepository.findByTenantAndChannel.mockResolvedValue(null);
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const saved = writeRepository.save.mock.calls[0][0];
    expect(saved.tenantId.value).toBe(VALID_INPUT.tenantId);
    expect(saved.envelope.value).toBe(ENVELOPE);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(saved.id.value);
  });

  it('rotates the existing destination instead of creating a second row', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    writeRepository.findByTenantAndChannel.mockResolvedValue({
      id: { value: '99999999-9999-4999-8999-999999999999' },
      tenantId: { value: VALID_INPUT.tenantId },
      channel: { value: NotificationChannelEnum.DISCORD },
      envelope: { value: 'old-envelope' },
      createdAt: { value: now },
      updatedAt: { value: now },
      rotate: vi.fn(),
      getUncommittedEvents: vi.fn().mockReturnValue([]),
      commit: vi.fn(),
    } as never);
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    const existing =
      await writeRepository.findByTenantAndChannel.mock.results[0].value;
    expect(existing.rotate).toHaveBeenCalledTimes(1);
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('retries once as a rotation when the first save hits a 23505 unique violation (D12)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const rotatedAggregate = {
      id: { value: '99999999-9999-4999-8999-999999999999' },
      tenantId: { value: VALID_INPUT.tenantId },
      channel: { value: NotificationChannelEnum.DISCORD },
      envelope: { value: 'old-envelope' },
      createdAt: { value: now },
      updatedAt: { value: now },
      rotate: vi.fn(),
      getUncommittedEvents: vi.fn().mockReturnValue([]),
      commit: vi.fn(),
    };
    writeRepository.findByTenantAndChannel
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(rotatedAggregate as never);
    writeRepository.save
      .mockRejectedValueOnce(buildUniqueViolation())
      .mockImplementationOnce((aggregate) => Promise.resolve(aggregate));

    const result = await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    expect(writeRepository.findByTenantAndChannel).toHaveBeenCalledTimes(2);
    expect(writeRepository.save).toHaveBeenCalledTimes(2);
    expect(rotatedAggregate.rotate).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('rethrows an unexpected save error unchanged, without a retry', async () => {
    writeRepository.findByTenantAndChannel.mockResolvedValue(null);
    const unexpected = new Error('boom');
    writeRepository.save.mockRejectedValue(unexpected);

    await expect(
      handler.execute(
        new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
      ),
    ).rejects.toBe(unexpected);
    expect(writeRepository.findByTenantAndChannel).toHaveBeenCalledTimes(1);
  });

  it('never reaches encrypt() when the command constructor already rejected the input', () => {
    expect(
      () =>
        new RegisterNotificationChannelDestinationCommand({
          ...VALID_INPUT,
          channel: NotificationChannelEnum.EMAIL,
        }),
    ).toThrow();
    expect(secretCipherPort.encrypt).not.toHaveBeenCalled();
  });
});
