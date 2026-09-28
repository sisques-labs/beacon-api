import { Logger, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { RegisterNotificationChannelDestinationResult } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination-result.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { CurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';
import { NotificationChannelDestinationRegisterRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-channel-destination-register.request.dto';

/**
 * D24: the target tenant is always the authenticated client's own tenant,
 * resolved through `@CurrentClient()` — never taken from the mutation input
 * (spec: "API-Key-Authenticated Registration and Reads"). Class-level
 * `@UseGuards(ClientApiKeyGuard)` (D21) covers this resolver; the guard
 * reflection spec enforces this pairing across `notifications/transport/`.
 */
@Resolver()
@UseGuards(ClientApiKeyGuard)
export class NotificationChannelDestinationRegisterResolver {
  private readonly logger = new Logger(
    NotificationChannelDestinationRegisterResolver.name,
  );

  constructor(
    private readonly commandBus: CommandBus,
    // D2: MutationResponseGraphQLMapper is provided globally by
    // SharedGraphQLModule — never re-add it to this context's providers.
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  @Mutation(() => MutationResponseDto, {
    name: 'notificationChannelDestinationRegister',
    description: "Register or rotate the caller's own webhook",
  })
  async notificationChannelDestinationRegister(
    @Args('input') input: NotificationChannelDestinationRegisterRequestDto,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<MutationResponseDto> {
    this.logger.log(
      `GraphQL notificationChannelDestinationRegister tenant=${authenticatedClient.tenantId}`,
    );

    const result = await this.commandBus.execute<
      RegisterNotificationChannelDestinationCommand,
      RegisterNotificationChannelDestinationResult
    >(
      new RegisterNotificationChannelDestinationCommand({
        tenantId: authenticatedClient.tenantId,
        channel: input.channel,
        webhookUrl: input.webhookUrl,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      id: result.id,
      message: 'Notification channel destination registered',
    });
  }
}
