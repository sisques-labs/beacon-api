import { ApiProperty } from '@nestjs/swagger';

export class NotificationCreateResponseDto {
  @ApiProperty()
  id!: string;
}
