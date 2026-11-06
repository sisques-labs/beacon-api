import { ApiProperty } from '@nestjs/swagger';

export class NotificationChannelDestinationRegisterResponseDto {
  @ApiProperty()
  id!: string;
}
