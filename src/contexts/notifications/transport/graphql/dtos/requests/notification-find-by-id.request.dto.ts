import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

@InputType()
export class NotificationFindByIdRequestDto {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  id!: string;
}
