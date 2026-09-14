import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-create.request.dto';

@Resolver()
export class NotificationMutationsResolver {
  private readonly logger = new Logger(NotificationMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    // D2: MutationResponseGraphQLMapper is provided globally by
    // SharedGraphQLModule — never re-add it to this context's providers.
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  // D7: deliberately unauthenticated — no @UseGuards(JwtAuthGuard) here.
  // Recorded, deferred tradeoff; see design.md decision D7.
  @Mutation(() => MutationResponseDto, {
    name: 'notificationCreate',
    description: 'Create a notification. Idempotent per (tenantId, dedupeKey).',
  })
  async notificationCreate(
    @Args('input') input: NotificationCreateRequestDto,
  ): Promise<MutationResponseDto> {
    this.logger.log('GraphQL notificationCreate');

    const result = await this.commandBus.execute<
      CreateNotificationCommand,
      CreateNotificationResult
    >(
      new CreateNotificationCommand({
        tenantId: input.tenantId,
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
