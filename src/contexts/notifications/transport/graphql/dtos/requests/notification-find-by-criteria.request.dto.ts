import { Field, InputType } from '@nestjs/graphql';
import { BaseFindByCriteriaInput } from '@sisques-labs/nestjs-kit/graphql';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { NotificationFilterInput } from '@contexts/notifications/transport/graphql/dtos/requests/notification-filter.input';
import { NotificationSortInput } from '@contexts/notifications/transport/graphql/dtos/requests/notification-sort.input';

@InputType()
export class NotificationFindByCriteriaRequestDto extends BaseFindByCriteriaInput {
  @Field(() => [NotificationFilterInput], {
    nullable: true,
    defaultValue: [],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NotificationFilterInput)
  declare filters?: NotificationFilterInput[];

  @Field(() => [NotificationSortInput], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NotificationSortInput)
  declare sorts?: NotificationSortInput[];
}
