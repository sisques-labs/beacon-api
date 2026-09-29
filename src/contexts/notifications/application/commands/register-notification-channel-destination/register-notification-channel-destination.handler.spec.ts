import { EventBus } from '@nestjs/cqrs';
import {
  Criteria,
  FilterOperator,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Mocked, vi } from 'vitest';

import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { RegisterNotificationChannelDestinationCommandHandler } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.handler';
import { EncryptChannelDestinationSecretService } from '@contexts/notifications/application/services/write/encrypt-channel-destination-secret/encrypt-channel-destination-secret.service';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { DestinationAlreadyExistsException } from '@contexts/notifications/domain/exceptions/destination-already-exists.exception';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { INotificationChannelDestinationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';

const VALID_INPUT = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  channel: NotificationChannelEnum.DISCORD,
  webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/aValidToken',
};

const ENVELOPE = 'v1:iv:tag:ct';

function pageOf(items: unknown[]): PaginatedResult<never> {
  return new PaginatedResult(items as never[], items.length, 1, 10);
}

function buildAlreadyExists(): DestinationAlreadyExistsException {
  return new DestinationAlreadyExistsException(
    VALID_INPUT.tenantId,
    VALID_INPUT.channel,
  );
}

describe('RegisterNotificationChannelDestinationCommandHandler', () => {
  let handler: RegisterNotificationChannelDestinationCommandHandler;
  let writeRepository: Mocked<INotificationChannelDestinationWriteRepository>;
  let encryptService: Mocked<EncryptChannelDestinationSecretService>;
  let eventBus: Mocked<EventBus>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationChannelDestinationWriteRepository>;
    encryptService = {
      execute: vi.fn().mockResolvedValue(ENVELOPE),
    } as unknown as Mocked<EncryptChannelDestinationSecretService>;
    eventBus = { publishAll: vi.fn() } as unknown as Mocked<EventBus>;
    handler = new RegisterNotificationChannelDestinationCommandHandler(
      writeRepository,
      encryptService,
      new NotificationChannelDestinationBuilder(),
      eventBus,
    );
  });

  it('encrypts the webhook URL for the tenant and channel via the encryption service (D5)', async () => {
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    expect(encryptService.execute).toHaveBeenCalledWith({
      tenantId: VALID_INPUT.tenantId,
      channel: VALID_INPUT.channel,
      plaintext: VALID_INPUT.webhookUrl,
    });
  });

  it('persists the awaited envelope string, not a Promise', async () => {
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    expect(typeof writeRepository.save.mock.calls[0][0].envelope.value).toBe(
      'string',
    );
  });

  it('does not leak state between two consecutive registrations on the shared builder', async () => {
    const otherTenant = '22222222-2222-4222-8222-222222222222';
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );
    encryptService.execute
      .mockResolvedValueOnce('envelope-1')
      .mockResolvedValueOnce('envelope-2');

    await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );
    await handler.execute(
      new RegisterNotificationChannelDestinationCommand({
        ...VALID_INPUT,
        tenantId: otherTenant,
      }),
    );

    const first = writeRepository.save.mock.calls[0][0];
    const second = writeRepository.save.mock.calls[1][0];
    expect(first).not.toBe(second);
    expect(first.id.value).not.toBe(second.id.value);
    expect(first.tenantId.value).toBe(VALID_INPUT.tenantId);
    expect(first.envelope.value).toBe('envelope-1');
    expect(second.tenantId.value).toBe(otherTenant);
    expect(second.envelope.value).toBe('envelope-2');
  });

  it('looks the destination up by tenantId AND channel equality on the default first page', async () => {
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    const criteria: Criteria = writeRepository.findByCriteria.mock.calls[0][0];
    expect(criteria.filters).toEqual([
      {
        field: 'tenantId',
        operator: FilterOperator.EQUALS,
        value: VALID_INPUT.tenantId,
      },
      {
        field: 'channel',
        operator: FilterOperator.EQUALS,
        value: NotificationChannelEnum.DISCORD,
      },
    ]);
    expect(criteria.sorts).toEqual([]);
    expect(criteria.pagination).toEqual({ page: 1, perPage: 10 });
  });

  it('creates a new destination and emits register() when none exists', async () => {
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
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
    writeRepository.findByCriteria.mockResolvedValue(
      pageOf([
        {
          id: { value: '99999999-9999-4999-8999-999999999999' },
          tenantId: { value: VALID_INPUT.tenantId },
          channel: { value: NotificationChannelEnum.DISCORD },
          envelope: { value: 'old-envelope' },
          createdAt: { value: now },
          updatedAt: { value: now },
          rotate: vi.fn(),
          getUncommittedEvents: vi.fn().mockReturnValue([]),
          commit: vi.fn(),
        },
      ]),
    );
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    const existing = (
      await writeRepository.findByCriteria.mock.results[0].value
    ).items[0];
    expect(existing.rotate).toHaveBeenCalledTimes(1);
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('retries once as a rotation when the first save throws DestinationAlreadyExistsException (D12)', async () => {
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
    writeRepository.findByCriteria
      .mockResolvedValueOnce(pageOf([]))
      .mockResolvedValueOnce(pageOf([rotatedAggregate]));
    writeRepository.save
      .mockRejectedValueOnce(buildAlreadyExists())
      .mockImplementationOnce((aggregate) => Promise.resolve(aggregate));

    const result = await handler.execute(
      new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
    );

    expect(writeRepository.findByCriteria).toHaveBeenCalledTimes(2);
    expect(writeRepository.save).toHaveBeenCalledTimes(2);
    expect(rotatedAggregate.rotate).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('does not retry a second time when the retry save also throws DestinationAlreadyExistsException', async () => {
    const alreadyExists = buildAlreadyExists();
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
    writeRepository.save.mockRejectedValue(alreadyExists);

    await expect(
      handler.execute(
        new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
      ),
    ).rejects.toBe(alreadyExists);
    expect(writeRepository.save).toHaveBeenCalledTimes(2);
  });

  it('rethrows an unexpected save error unchanged, without a retry', async () => {
    writeRepository.findByCriteria.mockResolvedValue(pageOf([]));
    const unexpected = new Error('boom');
    writeRepository.save.mockRejectedValue(unexpected);

    await expect(
      handler.execute(
        new RegisterNotificationChannelDestinationCommand(VALID_INPUT),
      ),
    ).rejects.toBe(unexpected);
    expect(writeRepository.findByCriteria).toHaveBeenCalledTimes(1);
  });

  it('never reaches encrypt() when the command constructor already rejected the input', () => {
    expect(
      () =>
        new RegisterNotificationChannelDestinationCommand({
          ...VALID_INPUT,
          channel: NotificationChannelEnum.EMAIL,
        }),
    ).toThrow();
    expect(encryptService.execute).not.toHaveBeenCalled();
  });
});
