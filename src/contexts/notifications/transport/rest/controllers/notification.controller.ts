import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import {
  readApiKeyHeaderValue,
  warnIfApiKeyMissing,
} from '@contexts/notifications/infrastructure/logging/api-key-readiness-warning';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/rest/dtos/notification-create-request.dto';
import { NotificationCreateResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-create-response.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-response.dto';
import { NotificationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification.mapper';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly notificationRestMapper: NotificationRestMapper,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by id' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  async findById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`GET /notifications/${id}`);
    // Phase A readiness warning (design.md D13/27.1) — this endpoint stays
    // unguarded until Phase B, so there is no authenticated tenantId to
    // report here yet.
    warnIfApiKeyMissing(this.logger, readApiKeyHeaderValue(request.headers));
    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(new NotificationFindByIdQuery({ id }));
    return new NotificationResponseDto(viewModel);
  }

  // D7: deliberately unauthenticated — no @UseGuards(JwtAuthGuard) here.
  // Recorded, deferred tradeoff; see design.md decision D7.
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, type: NotificationCreateResponseDto })
  async create(
    @Body() dto: NotificationCreateRequestDto,
    @Req() request: Request,
  ): Promise<NotificationCreateResponseDto> {
    this.logger.log('POST /notifications');
    // Phase A readiness warning (design.md D13/27.1) — behavior is
    // unchanged, and tenantId still comes from the body (D22 in Phase B).
    warnIfApiKeyMissing(
      this.logger,
      readApiKeyHeaderValue(request.headers),
      dto.tenantId,
    );
    const result = await this.commandBus.execute<
      CreateNotificationCommand,
      CreateNotificationResult
    >(
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
    return this.notificationRestMapper.toResponseDtoFromResult(result);
  }
}
