import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { Repository } from 'typeorm';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { IClientWriteRepository } from '@contexts/clients/domain/repositories/write/client-write.repository';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';

@Injectable()
export class ClientTypeormWriteRepository
  extends BaseDatabaseRepository
  implements IClientWriteRepository
{
  constructor(
    @InjectRepository(ClientEntity)
    private readonly repository: Repository<ClientEntity>,
    private readonly mapper: ClientTypeormMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<ClientAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByApiKeyId(apiKeyId: string): Promise<ClientAggregate | null> {
    const entity = await this.repository.findOne({ where: { apiKeyId } });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<ClientAggregate>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);
    const qb = applyCriteriaToQueryBuilder(
      this.repository.createQueryBuilder('client'),
      criteria,
      { alias: 'client' },
    );
    const [entities, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toAggregate(entity)),
      total,
      page,
      limit,
    );
  }

  async save(aggregate: ClientAggregate): Promise<ClientAggregate> {
    const entity = this.mapper.toEntity(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toAggregate(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
