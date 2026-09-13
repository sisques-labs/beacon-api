import { Inject, Injectable, Logger } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

export interface FindNotificationByDedupeKeyInput {
  tenantId: string;
  dedupeKey: string;
}

@Injectable()
export class FindNotificationByDedupeKeyService implements IBaseService<
  FindNotificationByDedupeKeyInput,
  CreateNotificationResult | null
> {
  private readonly logger = new Logger(FindNotificationByDedupeKeyService.name);

  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
  ) {}

  async execute(
    input: FindNotificationByDedupeKeyInput,
  ): Promise<CreateNotificationResult | null> {
    const existing = await this.writeRepository.findByDedupeKey(
      input.tenantId,
      input.dedupeKey,
    );
    if (!existing) {
      return null;
    }

    this.logger.log(
      `Idempotent no-op: notification already exists for tenant ${input.tenantId}, dedupeKey ${input.dedupeKey}`,
    );
    return { id: existing.id.value };
  }
}
