import { Field, ObjectType } from '@nestjs/graphql';
import { BasePaginatedResultDto } from '@sisques-labs/nestjs-kit/graphql';

import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification.response.dto';

@ObjectType('NotificationPaginatedResponseDto')
export class NotificationPaginatedResponseDto extends BasePaginatedResultDto {
  @Field(() => [NotificationResponseDto])
  items!: NotificationResponseDto[];
}
