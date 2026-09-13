import { Controller, Get, Logger, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-response.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by id' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  async findById(@Param('id') id: string): Promise<NotificationResponseDto> {
    this.logger.log(`GET /notifications/${id}`);
    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(new NotificationFindByIdQuery({ id }));
    return new NotificationResponseDto(viewModel);
  }
}
