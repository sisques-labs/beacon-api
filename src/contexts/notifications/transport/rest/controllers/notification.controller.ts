import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { CurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';
import { warnIfTenantIdMismatch } from '@contexts/notifications/infrastructure/logging/tenant-id-mismatch-warning';
import { NotificationCreateRequestDto } from '@contexts/notifications/transport/rest/dtos/notification-create-request.dto';
import { NotificationCreateResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-create-response.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-response.dto';
import { NotificationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification.mapper';

/**
 * Phase B (design.md D21/D22/D25): class-level `@UseGuards(ClientApiKeyGuard)`
 * covers both methods below. `findById` is tenant-scoped to the
 * authenticated client — a notification belonging to another tenant is
 * returned as 404, never 403 (D25). The creation tenant is always the
 * authenticated client's own tenant, resolved through `@CurrentClient()`;
 * the deprecated body `tenantId` (D22) is accepted for compatibility but
 * NEVER read to determine the creation tenant.
 */
@ApiTags('notifications')
@ApiHeader({
  name: 'x-api-key',
  description: "The requesting client's API key.",
  required: true,
})
@Controller('notifications')
@UseGuards(ClientApiKeyGuard)
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
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<NotificationResponseDto> {
    this.logger.log(
      `GET /notifications/${id} tenant=${authenticatedClient.tenantId}`,
    );
    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(
      new NotificationFindByIdQuery({
        id,
        tenantId: authenticatedClient.tenantId,
      }),
    );
    return new NotificationResponseDto(viewModel);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, type: NotificationCreateResponseDto })
  async create(
    @Body() dto: NotificationCreateRequestDto,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<NotificationCreateResponseDto> {
    this.logger.log(
      `POST /notifications tenant=${authenticatedClient.tenantId}`,
    );
    warnIfTenantIdMismatch(
      this.logger,
      dto.tenantId,
      authenticatedClient.tenantId,
    );
    const result = await this.commandBus.execute<
      CreateNotificationCommand,
      CreateNotificationResult
    >(
      new CreateNotificationCommand({
        tenantId: authenticatedClient.tenantId,
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
