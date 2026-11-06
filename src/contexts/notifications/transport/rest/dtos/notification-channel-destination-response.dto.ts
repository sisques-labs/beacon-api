import { ApiProperty } from '@nestjs/swagger';

/**
 * Metadata-only read (D10, spec: "Metadata-Only Reads"). Never carries the
 * webhook URL, plaintext or ciphertext, in any field.
 */
export class NotificationChannelDestinationResponseDto {
  @ApiProperty()
  configured!: boolean;

  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ required: false })
  channel?: string;

  @ApiProperty({ required: false, type: Date })
  createdAt?: Date;

  @ApiProperty({ required: false, type: Date })
  updatedAt?: Date;
}
