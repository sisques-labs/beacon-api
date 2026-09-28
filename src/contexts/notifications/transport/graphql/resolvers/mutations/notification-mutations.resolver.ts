import { Logger, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { CurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';
import { warnIfTenantIdMismatch } from '@contexts/notifications/infrastructure/logging/tenant-id-mismatch-warning';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-create.request.dto';

/**
 * Phase B (design.md D21/D22): class-level `@UseGuards(ClientApiKeyGuard)`.
 * The creation tenant is always the authenticated client's own tenant,
 * resolved through `@CurrentClient()`; the deprecated input `tenantId`
 * (D22) is accepted for compatibility but NEVER read to determine the
 * creation tenant.
 */
@Resolver()
@UseGuards(ClientApiKeyGuard)
export class NotificationMutationsResolver {
  private readonly logger = new Logger(NotificationMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    // D2: MutationResponseGraphQLMapper is provided globally by
    // SharedGraphQLModule — never re-add it to this context's providers.
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  @Mutation(() => MutationResponseDto, {
    name: 'notificationCreate',
    description: 'Create a notification. Idempotent per (tenantId, dedupeKey).',
  })
  async notificationCreate(
    @Args('input') input: NotificationCreateRequestDto,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<MutationResponseDto> {
    this.logger.log(
      `GraphQL notificationCreate tenant=${authenticatedClient.tenantId}`,
    );
    warnIfTenantIdMismatch(
      this.logger,
      input.tenantId,
      authenticatedClient.tenantId,
    );

    const result = await this.commandBus.execute<
      CreateNotificationCommand,
      CreateNotificationResult
    >(
      new CreateNotificationCommand({
        tenantId: authenticatedClient.tenantId,
        recipientUserId: input.recipientUserId,
        channel: input.channel,
        title: input.title,
        body: input.body,
        sourceService: input.sourceService,
        dedupeKey: input.dedupeKey,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      id: result.id,
      message: 'Notification created',
    });
  }
}
