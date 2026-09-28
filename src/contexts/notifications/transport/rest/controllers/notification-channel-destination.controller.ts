import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RegisterNotificationChannelDestinationResult } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination-result.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationChannelDestinationFindByTenantAndChannelQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-tenant-and-channel/notification-channel-destination-find-by-tenant-and-channel.query';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { CurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';
import { NotificationChannelDestinationRegisterRequestDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-register-request.dto';
import { NotificationChannelDestinationRegisterResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-register-response.dto';
import { NotificationChannelDestinationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-response.dto';
import { NotificationChannelDestinationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification-channel-destination.mapper';

/**
 * D24: no `:tenantId` in either route. The target tenant is always the
 * authenticated client's own tenant, resolved through `@CurrentClient()` —
 * never taken from the request body or path (spec: "API-Key-Authenticated
 * Registration and Reads"). Class-level `@UseGuards(ClientApiKeyGuard)`
 * (D21) covers both methods; the guard reflection spec enforces this
 * pairing across `notifications/transport/`.
 */
@ApiTags('notification-destinations')
@ApiHeader({
  name: 'x-api-key',
  description: "The requesting client's API key.",
  required: true,
})
@Controller('notification-destinations')
@UseGuards(ClientApiKeyGuard)
export class NotificationChannelDestinationController {
  private readonly logger = new Logger(
    NotificationChannelDestinationController.name,
  );

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly notificationChannelDestinationRestMapper: NotificationChannelDestinationRestMapper,
  ) {}

  @Put(':channel')
  @HttpCode(200)
  @ApiOperation({ summary: "Register or rotate the caller's own webhook" })
  @ApiResponse({
    status: 200,
    type: NotificationChannelDestinationRegisterResponseDto,
  })
  async register(
    @Param('channel') channel: string,
    @Body() dto: NotificationChannelDestinationRegisterRequestDto,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<NotificationChannelDestinationRegisterResponseDto> {
    this.logger.log(
      `PUT /notification-destinations/${channel} tenant=${authenticatedClient.tenantId}`,
    );
    const result = await this.commandBus.execute<
      RegisterNotificationChannelDestinationCommand,
      RegisterNotificationChannelDestinationResult
    >(
      new RegisterNotificationChannelDestinationCommand({
        tenantId: authenticatedClient.tenantId,
        channel,
        webhookUrl: dto.webhookUrl,
      }),
    );
    return this.notificationChannelDestinationRestMapper.toResponseDtoFromResult(
      result,
    );
  }

  @Get(':channel')
  @ApiOperation({ summary: "Read the caller's own webhook metadata" })
  @ApiResponse({
    status: 200,
    type: NotificationChannelDestinationResponseDto,
  })
  async findMetadata(
    @Param('channel') channel: string,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<NotificationChannelDestinationResponseDto> {
    this.logger.log(
      `GET /notification-destinations/${channel} tenant=${authenticatedClient.tenantId}`,
    );
    const viewModel = await this.queryBus.execute<
      NotificationChannelDestinationFindByTenantAndChannelQuery,
      NotificationChannelDestinationViewModel | null
    >(
      new NotificationChannelDestinationFindByTenantAndChannelQuery({
        tenantId: authenticatedClient.tenantId,
        channel,
      }),
    );
    return this.notificationChannelDestinationRestMapper.toResponseDtoFromViewModel(
      viewModel,
    );
  }
}
