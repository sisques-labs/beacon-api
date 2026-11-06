import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';
import { Mocked, vi } from 'vitest';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationRegisterRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-channel-destination-register.request.dto';
import { NotificationChannelDestinationRegisterResolver } from '@contexts/notifications/transport/graphql/resolvers/mutations/notification-channel-destination-register.resolver';

const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: '99999999-9999-4999-8999-999999999999',
  tenantId: '22222222-2222-4222-8222-222222222222',
};

const SECRET_WEBHOOK_URL =
  'https://discord.com/api/webhooks/123456789012345678/aValidToken';

function buildRegisterRequestDto(): NotificationChannelDestinationRegisterRequestDto {
  const dto = new NotificationChannelDestinationRegisterRequestDto();
  dto.channel = NotificationChannelEnum.DISCORD;
  dto.webhookUrl = SECRET_WEBHOOK_URL;
  return dto;
}

describe('NotificationChannelDestinationRegisterResolver', () => {
  let resolver: NotificationChannelDestinationRegisterResolver;
  let commandBus: Mocked<CommandBus>;
  let mapper: Mocked<MutationResponseGraphQLMapper>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    mapper = {
      toResponseDto: vi.fn(),
    } as unknown as Mocked<MutationResponseGraphQLMapper>;
    resolver = new NotificationChannelDestinationRegisterResolver(
      commandBus,
      mapper,
    );
  });

  it('dispatches RegisterNotificationChannelDestinationCommand for the authenticated tenant only', async () => {
    const dto = buildRegisterRequestDto();
    commandBus.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );

    await resolver.notificationChannelDestinationRegister(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new RegisterNotificationChannelDestinationCommand({
        tenantId: AUTHENTICATED_CLIENT.tenantId,
        channel: dto.channel,
        webhookUrl: dto.webhookUrl,
      }),
    );
  });

  it('maps the CommandBus result to a MutationResponseDto via the mapper', async () => {
    const dto = buildRegisterRequestDto();
    const commandResult = { id: '44444444-4444-4444-8444-444444444444' };
    const mapped = {
      success: true,
      id: commandResult.id,
      message: 'Notification channel destination registered',
    } as MutationResponseDto;
    commandBus.execute.mockResolvedValue(commandResult);
    mapper.toResponseDto.mockReturnValue(mapped);

    const result = await resolver.notificationChannelDestinationRegister(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(mapper.toResponseDto).toHaveBeenCalledWith({
      success: true,
      id: commandResult.id,
      message: expect.any(String),
    });
    expect(result).toBe(mapped);
  });

  it('never logs the webhook URL', async () => {
    const dto = buildRegisterRequestDto();
    commandBus.execute.mockResolvedValue({ id: 'some-id' });
    mapper.toResponseDto.mockReturnValue(
      new MutationResponseDto() as MutationResponseDto,
    );
    const logSpy = vi.spyOn(Logger.prototype, 'log');
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');
    const errorSpy = vi.spyOn(Logger.prototype, 'error');

    await resolver.notificationChannelDestinationRegister(
      dto,
      AUTHENTICATED_CLIENT,
    );

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
