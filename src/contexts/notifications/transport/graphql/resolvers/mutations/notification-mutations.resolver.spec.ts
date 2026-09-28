import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-create.request.dto';
import { NotificationMutationsResolver } from '@contexts/notifications/transport/graphql/resolvers/mutations/notification-mutations.resolver';

const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: '99999999-9999-4999-8999-999999999999',
  tenantId: '22222222-2222-4222-8222-222222222222',
};

function buildCreateRequestDto(
  overrides: Partial<NotificationCreateRequestDto> = {},
): NotificationCreateRequestDto {
  const dto = new NotificationCreateRequestDto();
  dto.recipientUserId = '33333333-3333-4333-8333-333333333333';
  dto.channel = NotificationChannelEnum.DISCORD;
  dto.title = 'Title';
  dto.body = 'Body';
  dto.sourceService = 'gardenia';
  dto.dedupeKey = 'dedupe-key-1';
  return Object.assign(dto, overrides);
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

  afterEach(() => {
    vi.restoreAllMocks();
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

    await resolver.notificationCreate(dto, AUTHENTICATED_CLIENT);

    expect(logSpy).toHaveBeenCalled();
  });

  it('dispatches CreateNotificationCommand using the authenticated tenant, not the input', async () => {
    const dto = buildCreateRequestDto({
      tenantId: '99999999-9999-4999-8999-000000000000',
    });
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto, AUTHENTICATED_CLIENT);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new CreateNotificationCommand({
        tenantId: AUTHENTICATED_CLIENT.tenantId,
        recipientUserId: dto.recipientUserId,
        channel: dto.channel,
        title: dto.title,
        body: dto.body,
        sourceService: dto.sourceService,
        dedupeKey: dto.dedupeKey,
      }),
    );
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

    const result = await resolver.notificationCreate(dto, AUTHENTICATED_CLIENT);

    expect(mapper.toResponseDto).toHaveBeenCalledWith({
      success: true,
      id: '44444444-4444-4444-8444-444444444444',
      message: expect.any(String),
    });
    expect(result).toBe(mapped);
  });

  it('logs a warning when the input tenantId mismatches the authenticated tenant, and still creates for the authenticated tenant', async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const dto = buildCreateRequestDto({
      tenantId: '99999999-9999-4999-8999-000000000000',
    });
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto, AUTHENTICATED_CLIENT);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain(dto.tenantId as string);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('does not warn when the input tenantId matches the authenticated tenant', async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const dto = buildCreateRequestDto({
      tenantId: AUTHENTICATED_CLIENT.tenantId,
    });
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto, AUTHENTICATED_CLIENT);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when no input tenantId is presented', async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const dto = buildCreateRequestDto();
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationCreate(dto, AUTHENTICATED_CLIENT);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
