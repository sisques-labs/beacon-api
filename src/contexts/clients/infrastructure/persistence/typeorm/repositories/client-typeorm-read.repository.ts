import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { FindOptionsSelect, Repository } from 'typeorm';

import { IClientReadRepository } from '@contexts/clients/domain/repositories/read/client-read.repository';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';

/**
 * Metadata columns only (D17, mirrors D10) — `apiKeySecretHash` MUST NEVER
 * appear here. A read can never return the secret hash in any form.
 */
const METADATA_SELECT: FindOptionsSelect<ClientEntity> = {
  id: true,
  tenantId: true,
  name: true,
  apiKeyId: true,
  apiKeyRotatedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
};
const METADATA_SELECT_ALIASED = Object.keys(METADATA_SELECT).map(
  (column) => `client.${column}`,
);

@Injectable()
export class ClientTypeormReadRepository
  extends BaseDatabaseRepository
  implements IClientReadRepository
{
  constructor(
    @InjectRepository(ClientEntity)
    private readonly repository: Repository<ClientEntity>,
    private readonly mapper: ClientTypeormMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<ClientViewModel | null> {
    const entity = await this.repository.findOne({
      where: { id },
      select: METADATA_SELECT,
    });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findAll(): Promise<ClientViewModel[]> {
    const entities = await this.repository.find({ select: METADATA_SELECT });
    return entities.map((entity) => this.mapper.toViewModel(entity));
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<ClientViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);
    const qb = applyCriteriaToQueryBuilder(
      this.repository
        .createQueryBuilder('client')
        .select(METADATA_SELECT_ALIASED),
      criteria,
      { alias: 'client' },
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
   * Metadata-only `update` (D17, mirrors D10) — never touches
   * `apiKeySecretHash`, so a read-side save can never null or overwrite the
   * stored hash.
   */
  async save(viewModel: ClientViewModel): Promise<void> {
    await this.repository.update(viewModel.id, {
      tenantId: viewModel.tenantId,
      name: viewModel.name,
      apiKeyId: viewModel.apiKeyId,
      apiKeyRotatedAt: viewModel.apiKeyRotatedAt,
      revokedAt: viewModel.revokedAt,
      updatedAt: viewModel.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
