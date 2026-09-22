import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/rest/dtos/notification-create-request.dto';
import { NotificationCreateResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-create-response.dto';
import { NotificationController } from '@contexts/notifications/transport/rest/controllers/notification.controller';
import { NotificationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification.mapper';

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

function buildViewModel(): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    recipientUserId: '33333333-3333-4333-8333-333333333333',
    channel: 'DISCORD',
    status: 'PENDING',
    title: 'Title',
    body: 'Body',
    sourceService: 'gardenia',
    dedupeKey: 'dedupe-key-1',
    deliveryMode: 'DELIVER',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationController', () => {
  let controller: NotificationController;
  let queryBus: Mocked<QueryBus>;
  let commandBus: Mocked<CommandBus>;
  let notificationRestMapper: Mocked<NotificationRestMapper>;

  beforeEach(() => {
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    notificationRestMapper = {
      toResponseDtoFromResult: vi.fn(),
    } as unknown as Mocked<NotificationRestMapper>;
    controller = new NotificationController(
      queryBus,
      commandBus,
      notificationRestMapper,
    );
  });

  it('dispatches NotificationFindByIdQuery with the requested id', async () => {
    const viewModel = buildViewModel();
    queryBus.execute.mockResolvedValue(viewModel);

    await controller.findById(viewModel.id);

    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationFindByIdQuery({ id: viewModel.id }),
    );
  });

  it('returns a response DTO built from the view model', async () => {
    const viewModel = buildViewModel();
    queryBus.execute.mockResolvedValue(viewModel);

    const result = await controller.findById(viewModel.id);

    expect(result).toEqual({
      id: viewModel.id,
      tenantId: viewModel.tenantId,
      recipientUserId: viewModel.recipientUserId,
      channel: viewModel.channel,
      status: viewModel.status,
      title: viewModel.title,
      body: viewModel.body,
      sourceService: viewModel.sourceService,
      dedupeKey: viewModel.dedupeKey,
      failureReason: null,
      sentAt: null,
      readAt: null,
      cancelledAt: null,
      createdAt: viewModel.createdAt,
      updatedAt: viewModel.updatedAt,
    });
  });

  it('dispatches one CreateNotificationCommand built from the request DTO', async () => {
    const dto = buildCreateRequestDto();
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });

    await controller.create(dto);

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

  it('maps the CommandBus result to the create response via the REST mapper', async () => {
    const dto = buildCreateRequestDto();
    const commandResult = { id: '44444444-4444-4444-8444-444444444444' };
    const responseDto = new NotificationCreateResponseDto();
    responseDto.id = commandResult.id;
    commandBus.execute.mockResolvedValue(commandResult);
    notificationRestMapper.toResponseDtoFromResult.mockReturnValue(responseDto);

    const result = await controller.create(dto);

    expect(notificationRestMapper.toResponseDtoFromResult).toHaveBeenCalledWith(
      commandResult,
    );
    expect(result).toBe(responseDto);
  });
});
