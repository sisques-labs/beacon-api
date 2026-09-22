import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-create.request.dto';
import { NotificationMutationsResolver } from '@contexts/notifications/transport/graphql/resolvers/mutations/notification-mutations.resolver';

function buildCreateRequestDto(): NotificationCreateRequestDto {
  const dto = new NotificationCreateRequestDto();
  dto.tenantId = '22222222-2222-4222-8222-222222222222';
  dto.recipientUserId = '33333333-3333-4333-8333-333333333333';
  dto.channel = NotificationChannelEnum.DISCORD;
  dto.title = 'Title';
  dto.body = 'Body';
  dto.sourceService = 'gardenia';
  dto.dedupeKey = 'dedupe-key-1';
  return dto;
}

describe('NotificationMutationsResolver', () => {
  let resolver: NotificationMutationsResolver;
  let commandBus: Mocked<CommandBus>;
  let mapper: Mocked<MutationResponseGraphQLMapper>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    mapper = {
      toResponseDto: vi.fn(),
    } as unknown as Mocked<MutationResponseGraphQLMapper>;
    resolver = new NotificationMutationsResolver(commandBus, mapper);
  });

  it('logs at entry', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log');
    const dto = buildCreateRequestDto();
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto);

    expect(logSpy).toHaveBeenCalled();
  });

  it('dispatches one CreateNotificationCommand built from the input', async () => {
    const dto = buildCreateRequestDto();
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new CreateNotificationCommand({
        tenantId: dto.tenantId,
        recipientUserId: dto.recipientUserId,
        channel: dto.channel,
        title: dto.title,
        body: dto.body,
        sourceService: dto.sourceService,
        dedupeKey: dto.dedupeKey,
      }),
    );
  });

  it('dispatches CreateNotificationCommand carrying a valid deliveryMode', async () => {
    const dto = buildCreateRequestDto();
    dto.deliveryMode = NotificationDeliveryModeEnum.RECORD_ONLY;
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const dispatched = commandBus.execute.mock
      .calls[0][0] as CreateNotificationCommand;
    expect(dispatched.deliveryMode.value).toBe('RECORD_ONLY');
  });

  it('throws and never dispatches for an invalid deliveryMode (SSRF constraint D3 — URL-shaped value never accepted)', async () => {
    const dto = buildCreateRequestDto();
    dto.deliveryMode =
      'https://evil.example.com/webhook' as NotificationDeliveryModeEnum;

    await expect(resolver.notificationCreate(dto)).rejects.toThrow();

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('maps the CommandBus result to a MutationResponseDto via the mapper', async () => {
    const dto = buildCreateRequestDto();
    commandBus.execute.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
    });
    const mapped = {
      success: true,
      id: '44444444-4444-4444-8444-444444444444',
      message: 'Notification created',
    } as MutationResponseDto;
    mapper.toResponseDto.mockReturnValue(mapped);

    const result = await resolver.notificationCreate(dto);

    expect(mapper.toResponseDto).toHaveBeenCalledWith({
      success: true,
      id: '44444444-4444-4444-8444-444444444444',
      message: expect.any(String),
    });
    expect(result).toBe(mapped);
  });
});
