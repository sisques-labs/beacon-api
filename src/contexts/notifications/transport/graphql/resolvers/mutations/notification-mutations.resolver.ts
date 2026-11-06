import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';
import { Request } from 'express';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import {
  readApiKeyHeaderValue,
  warnIfApiKeyMissing,
} from '@contexts/notifications/infrastructure/logging/api-key-readiness-warning';
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
    @Context() context: { req: Request },
  ): Promise<MutationResponseDto> {
    this.logger.log('GraphQL notificationCreate');
    // Phase A readiness warning (design.md D13/27.1) — behavior is
    // unchanged, and tenantId still comes from the input (D22 in Phase B).
    warnIfApiKeyMissing(
      this.logger,
      readApiKeyHeaderValue(context.req.headers),
      input.tenantId,
    );

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
