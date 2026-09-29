import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import {
  Criteria,
  FilterOperator,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Mocked, vi } from 'vitest';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { NotificationChannelDestinationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.query';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationRegisterRequestDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-register-request.dto';
import { NotificationChannelDestinationRegisterResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-register-response.dto';
import { NotificationChannelDestinationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-response.dto';
import { NotificationChannelDestinationController } from '@contexts/notifications/transport/rest/controllers/notification-channel-destination.controller';
import { NotificationChannelDestinationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification-channel-destination.mapper';

const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: '99999999-9999-4999-8999-999999999999',
  tenantId: '22222222-2222-4222-8222-222222222222',
};

const SECRET_WEBHOOK_URL =
  'https://discord.com/api/webhooks/123456789012345678/aValidToken';

function buildRegisterRequestDto(): NotificationChannelDestinationRegisterRequestDto {
  const dto = new NotificationChannelDestinationRegisterRequestDto();
  dto.webhookUrl = SECRET_WEBHOOK_URL;
  return dto;
}

function emptyPage(): PaginatedResult<NotificationChannelDestinationViewModel> {
  return new PaginatedResult([], 0, 1, 10);
}

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: AUTHENTICATED_CLIENT.tenantId,
    channel: 'DISCORD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationController', () => {
  let controller: NotificationChannelDestinationController;
  let commandBus: Mocked<CommandBus>;
  let queryBus: Mocked<QueryBus>;
  let mapper: Mocked<NotificationChannelDestinationRestMapper>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    mapper = {
      toResponseDtoFromResult: vi.fn(),
      toResponseDtoFromViewModel: vi.fn(),
    } as unknown as Mocked<NotificationChannelDestinationRestMapper>;
    controller = new NotificationChannelDestinationController(
      commandBus,
      queryBus,
      mapper,
    );
  });

  describe('register', () => {
    it('dispatches RegisterNotificationChannelDestinationCommand for the authenticated tenant only', async () => {
      const dto = buildRegisterRequestDto();
      commandBus.execute.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
      });
      mapper.toResponseDtoFromResult.mockReturnValue(
        new NotificationChannelDestinationRegisterResponseDto(),
      );

      await controller.register('DISCORD', dto, AUTHENTICATED_CLIENT);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new RegisterNotificationChannelDestinationCommand({
          tenantId: AUTHENTICATED_CLIENT.tenantId,
          channel: 'DISCORD',
          webhookUrl: dto.webhookUrl,
        }),
      );
    });

    it('returns the response DTO built by the mapper from the command result', async () => {
      const dto = buildRegisterRequestDto();
      const commandResult = { id: '44444444-4444-4444-8444-444444444444' };
      const responseDto =
        new NotificationChannelDestinationRegisterResponseDto();
      responseDto.id = commandResult.id;
      commandBus.execute.mockResolvedValue(commandResult);
      mapper.toResponseDtoFromResult.mockReturnValue(responseDto);

      const result = await controller.register(
        'DISCORD',
        dto,
        AUTHENTICATED_CLIENT,
      );

      expect(mapper.toResponseDtoFromResult).toHaveBeenCalledWith(
        commandResult,
      );
      expect(result).toBe(responseDto);
    });

    it('never logs the webhook URL', async () => {
      const dto = buildRegisterRequestDto();
      commandBus.execute.mockResolvedValue({ id: 'some-id' });
      mapper.toResponseDtoFromResult.mockReturnValue(
        new NotificationChannelDestinationRegisterResponseDto(),
      );
      const logSpy = vi.spyOn(Logger.prototype, 'log');
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');
      const errorSpy = vi.spyOn(Logger.prototype, 'error');

      await controller.register('DISCORD', dto, AUTHENTICATED_CLIENT);

      const allCalls = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat();
      for (const call of allCalls) {
        expect(String(call)).not.toContain(SECRET_WEBHOOK_URL);
      }

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('findMetadata', () => {
    it('dispatches NotificationChannelDestinationFindByCriteriaQuery for the authenticated tenant only', async () => {
      queryBus.execute.mockResolvedValue(emptyPage());
      mapper.toResponseDtoFromViewModel.mockReturnValue(
        new NotificationChannelDestinationResponseDto(),
      );

      await controller.findMetadata('DISCORD', AUTHENTICATED_CLIENT);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        new NotificationChannelDestinationFindByCriteriaQuery({
          criteria: new Criteria([
            {
              field: 'tenantId',
              operator: FilterOperator.EQUALS,
              value: AUTHENTICATED_CLIENT.tenantId,
            },
            {
              field: 'channel',
              operator: FilterOperator.EQUALS,
              value: 'DISCORD',
            },
          ]),
        }),
      );
    });

    it('returns the response DTO built by the mapper from the view model', async () => {
      const viewModel = buildViewModel();
      const responseDto = new NotificationChannelDestinationResponseDto();
      responseDto.configured = true;
      queryBus.execute.mockResolvedValue(
        new PaginatedResult([viewModel], 1, 1, 10),
      );
      mapper.toResponseDtoFromViewModel.mockReturnValue(responseDto);

      const result = await controller.findMetadata(
        'DISCORD',
        AUTHENTICATED_CLIENT,
      );

      expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(viewModel);
      expect(result).toBe(responseDto);
    });

    it('maps an empty page to an unconfigured response DTO via the mapper', async () => {
      queryBus.execute.mockResolvedValue(emptyPage());
      const responseDto = new NotificationChannelDestinationResponseDto();
      responseDto.configured = false;
      mapper.toResponseDtoFromViewModel.mockReturnValue(responseDto);

      const result = await controller.findMetadata(
        'DISCORD',
        AUTHENTICATED_CLIENT,
      );

      expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(null);
      expect(result).toBe(responseDto);
    });
  });
});
