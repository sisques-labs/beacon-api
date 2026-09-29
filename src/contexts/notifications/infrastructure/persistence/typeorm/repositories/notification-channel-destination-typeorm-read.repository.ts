import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { FindOptionsSelect, Repository } from 'typeorm';

import { INotificationChannelDestinationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { assertNotificationChannelDestinationCriteria } from '@contexts/notifications/infrastructure/persistence/typeorm/criteria/notification-channel-destination-criteria.guard';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationChannelDestinationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-channel-destination-typeorm.mapper';

/**
 * Allowlist of columns this read side is allowed to fetch (D10).
 *
 * `encryptedAddress` (the AES-GCM envelope of the webhook URL) MUST NEVER
 * appear here. Every read method below passes this map as the `select`, so the
 * secret column is never loaded from the database and a read can never return
 * the webhook URL, plaintext or ciphertext. This does not rely on callers
 * remembering to strip the field afterwards.
 *
 * Consequences to keep in mind:
 * - Entities returned from this repository have `encryptedAddress ===
 *   undefined`. `NotificationChannelDestinationTypeormMapper.toViewModel`
 *   therefore builds the view model directly from the metadata columns instead
 *   of going through the builder, whose `validate()` requires an envelope.
 * - Code that needs the secret (delivery) must go through the write
 *   repository and the aggregate, never through this one.
 * - `select` limits what is returned, not what can be filtered or sorted on.
 *   That is guarded separately: `findByCriteria` first runs
 *   `assertNotificationChannelDestinationCriteria`, which rejects any filter or
 *   sort field outside the shared allowlist (`encryptedAddress` is never in
 *   it), so the secret column cannot be probed through `where`/`orderBy`.
 * - `METADATA_SELECT_ALIASED` is the same list prefixed with the query builder
 *   alias, used by `findByCriteria`.
 */
const METADATA_SELECT: FindOptionsSelect<NotificationChannelDestinationEntity> =
  {
    id: true,
    tenantId: true,
    channel: true,
    createdAt: true,
    updatedAt: true,
  };
const METADATA_SELECT_ALIASED = Object.keys(METADATA_SELECT).map(
  (column) => `notificationChannelDestination.${column}`,
);

@Injectable()
export class NotificationChannelDestinationTypeormReadRepository
  extends BaseDatabaseRepository
  implements INotificationChannelDestinationReadRepository
{
  constructor(
    @InjectRepository(NotificationChannelDestinationEntity)
    private readonly repository: Repository<NotificationChannelDestinationEntity>,
    private readonly mapper: NotificationChannelDestinationTypeormMapper,
  ) {
    super();
  }

  async findById(
    id: string,
  ): Promise<NotificationChannelDestinationViewModel | null> {
    const entity = await this.repository.findOne({
      where: { id },
      select: METADATA_SELECT,
    });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<NotificationChannelDestinationViewModel>> {
    assertNotificationChannelDestinationCriteria(criteria);
    const { page, limit, skip } = await this.calculatePagination(criteria);
    const qb = applyCriteriaToQueryBuilder(
      this.repository
        .createQueryBuilder('notificationChannelDestination')
        .select(METADATA_SELECT_ALIASED),
      criteria,
      { alias: 'notificationChannelDestination' },
    );
    const [entities, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toViewModel(entity)),
      total,
      page,
      limit,
    );
  }

  /**
   * Metadata-only `update` (D10) — never touches `encryptedAddress`, so a
   * read-side save can never null or overwrite the encrypted envelope.
   */
  async save(
    viewModel: NotificationChannelDestinationViewModel,
  ): Promise<void> {
    await this.repository.update(viewModel.id, {
      tenantId: viewModel.tenantId,
      channel: viewModel.channel,
      updatedAt: viewModel.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
