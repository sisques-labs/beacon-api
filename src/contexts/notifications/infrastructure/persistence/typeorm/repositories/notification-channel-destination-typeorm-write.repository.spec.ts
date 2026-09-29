import {
  Criteria,
  FilterOperator,
  SortDirection,
} from '@sisques-labs/nestjs-kit';
import { Mocked, vi } from 'vitest';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { DestinationAlreadyExistsException } from '@contexts/notifications/domain/exceptions/destination-already-exists.exception';
import { UnsupportedCriteriaFieldException } from '@contexts/notifications/domain/exceptions/unsupported-criteria-field.exception';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationChannelDestinationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-channel-destination-typeorm.mapper';
import { NotificationChannelDestinationTypeormWriteRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-channel-destination-typeorm-write.repository';

const ENVELOPE =
  'v1:aaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:Y2lwaGVydGV4dA';

function buildAggregate(): NotificationChannelDestinationAggregate {
  return new NotificationChannelDestinationBuilder()
    .withId('11111111-1111-4111-8111-111111111111')
    .withTenantId('22222222-2222-4222-8222-222222222222')
    .withChannel(NotificationChannelEnum.DISCORD)
    .withEnvelope(ENVELOPE)
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('NotificationChannelDestinationTypeormWriteRepository', () => {
  let repository: NotificationChannelDestinationTypeormWriteRepository;
  let ormRepository: Mocked<Repository<NotificationChannelDestinationEntity>>;
  let mapper: Mocked<NotificationChannelDestinationTypeormMapper>;

  beforeEach(() => {
    ormRepository = {
      findOne: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<NotificationChannelDestinationEntity>>;
    mapper = {
      toAggregate: vi.fn(),
      toEntity: vi.fn(),
      toViewModel: vi.fn(),
    } as unknown as Mocked<NotificationChannelDestinationTypeormMapper>;
    repository = new NotificationChannelDestinationTypeormWriteRepository(
      ormRepository,
      mapper,
    );
  });

  describe('findById', () => {
    it('returns null when no entity is found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('unknown-id');

      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new NotificationChannelDestinationEntity();
      const aggregate = buildAggregate();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.findById(
        '11111111-1111-4111-8111-111111111111',
      );

      expect(mapper.toAggregate).toHaveBeenCalledWith(entity);
      expect(result).toBe(aggregate);
    });
  });

  describe('findByCriteria', () => {
    const ALIAS = 'notificationChannelDestination';
    const MAPPED = buildAggregate();
    const ALL_FIELDS = ['id', 'tenantId', 'channel', 'createdAt', 'updatedAt'];
    let qb: Mocked<SelectQueryBuilder<NotificationChannelDestinationEntity>>;

    beforeEach(() => {
      qb = {
        select: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      } as unknown as Mocked<
        SelectQueryBuilder<NotificationChannelDestinationEntity>
      >;
      ormRepository.createQueryBuilder.mockReturnValue(qb);
      mapper.toAggregate.mockImplementation(() => MAPPED);
    });

    function filter(field: string, operator: FilterOperator, value: unknown) {
      return { field, operator, value };
    }

    it('applies no where clause and no order for an empty criteria, on the default page', async () => {
      const result = await repository.findByCriteria(new Criteria());

      expect(ormRepository.createQueryBuilder).toHaveBeenCalledWith(ALIAS);
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).not.toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toMatchObject({
        items: [],
        total: 0,
        page: 1,
        perPage: 10,
      });
    });

    it.each([
      [
        'tenantId only',
        [filter('tenantId', FilterOperator.EQUALS, 'tenant-1')],
        ['tenantId = :filter0'],
      ],
      [
        'channel only',
        [filter('channel', FilterOperator.EQUALS, 'DISCORD')],
        ['channel = :filter0'],
      ],
      [
        'id only',
        [filter('id', FilterOperator.EQUALS, 'id-1')],
        ['id = :filter0'],
      ],
      [
        'tenantId and channel',
        [
          filter('tenantId', FilterOperator.EQUALS, 'tenant-1'),
          filter('channel', FilterOperator.EQUALS, 'DISCORD'),
        ],
        ['tenantId = :filter0', 'channel = :filter1'],
      ],
    ])('filters by %s', async (_label, filters, clauses) => {
      await repository.findByCriteria(new Criteria(filters));

      expect(qb.andWhere.mock.calls.map(([sql]) => sql)).toEqual(
        clauses.map((clause) => `${ALIAS}.${clause}`),
      );
      filters.forEach((f, index) =>
        expect(qb.andWhere).toHaveBeenNthCalledWith(
          index + 1,
          expect.any(String),
          { [`filter${index}`]: f.value },
        ),
      );
    });

    it('returns an empty result for a value that matches nothing', async () => {
      const result = await repository.findByCriteria(
        new Criteria([filter('tenantId', FilterOperator.EQUALS, 'unknown')]),
      );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it.each(
      ALL_FIELDS.flatMap((field) =>
        [
          [FilterOperator.EQUALS, '=', 'v', 'v'],
          [FilterOperator.NOT_EQUALS, '!=', 'v', 'v'],
          [FilterOperator.LIKE, 'ILIKE', 'v', '%v%'],
          [FilterOperator.IN, 'IN (:...filter0)', ['a', 'b'], ['a', 'b']],
          [FilterOperator.IN, 'IN (:...filter0)', 'a', ['a']],
          [FilterOperator.GREATER_THAN, '>', 'v', 'v'],
          [FilterOperator.GREATER_THAN_OR_EQUAL, '>=', 'v', 'v'],
          [FilterOperator.LESS_THAN, '<', 'v', 'v'],
          [FilterOperator.LESS_THAN_OR_EQUAL, '<=', 'v', 'v'],
        ].map(([operator, sql, value, param]) => [
          field,
          operator,
          sql,
          value,
          param,
        ]),
      ),
    )(
      'translates %s %s (%s) with value %j into param %j',
      async (field, operator, sql, value, param) => {
        await repository.findByCriteria(
          new Criteria([
            filter(field as string, operator as FilterOperator, value),
          ]),
        );

        const expectedSql = String(sql).startsWith('IN')
          ? `${ALIAS}.${field} ${sql}`
          : `${ALIAS}.${field} ${sql} :filter0`;
        expect(qb.andWhere).toHaveBeenCalledWith(expectedSql, {
          filter0: param,
        });
      },
    );

    it.each(
      ALL_FIELDS.flatMap((field) => [
        [field, SortDirection.ASC],
        [field, SortDirection.DESC],
      ]),
    )('sorts by %s %s', async (field, direction) => {
      await repository.findByCriteria(
        new Criteria([], [{ field, direction: direction as SortDirection }]),
      );

      expect(qb.orderBy).toHaveBeenCalledWith(`${ALIAS}.${field}`, direction);
      expect(qb.addOrderBy).not.toHaveBeenCalled();
    });

    it('applies several sorts in order', async () => {
      await repository.findByCriteria(
        new Criteria(
          [],
          [
            { field: 'channel', direction: SortDirection.ASC },
            { field: 'createdAt', direction: SortDirection.DESC },
          ],
        ),
      );

      expect(qb.orderBy).toHaveBeenCalledWith(`${ALIAS}.channel`, 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith(`${ALIAS}.createdAt`, 'DESC');
    });

    it.each([
      [{ page: 1, perPage: 10 }, 0, 10],
      [{ page: 2, perPage: 10 }, 10, 10],
      [{ page: 3, perPage: 5 }, 10, 5],
      [{ page: 1, perPage: 1 }, 0, 1],
      [{ page: 0, perPage: 0 }, 0, 10],
    ])('paginates %j as skip %i / take %i', async (pagination, skip, take) => {
      await repository.findByCriteria(new Criteria([], [], pagination));

      expect(qb.skip).toHaveBeenCalledWith(skip);
      expect(qb.take).toHaveBeenCalledWith(take);
    });

    it('reports total, page and perPage from the count query', async () => {
      const entities = [
        new NotificationChannelDestinationEntity(),
        new NotificationChannelDestinationEntity(),
      ];
      qb.getManyAndCount.mockResolvedValue([entities, 12]);

      const result = await repository.findByCriteria(
        new Criteria([], [], { page: 2, perPage: 5 }),
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(12);
      expect(result.page).toBe(2);
      expect(result.perPage).toBe(5);
      expect(result.totalPages).toBe(3);
    });

    it('maps every returned entity', async () => {
      const entities = [
        new NotificationChannelDestinationEntity(),
        new NotificationChannelDestinationEntity(),
      ];
      qb.getManyAndCount.mockResolvedValue([entities, 2]);

      const result = await repository.findByCriteria(new Criteria());

      expect(mapper.toAggregate).toHaveBeenCalledTimes(2);
      expect(result.items).toEqual([MAPPED, MAPPED]);
    });

    it('combines filters, sorts and pagination', async () => {
      await repository.findByCriteria(
        new Criteria(
          [
            filter('tenantId', FilterOperator.IN, ['t1', 't2']),
            filter('channel', FilterOperator.NOT_EQUALS, 'EMAIL'),
            filter(
              'createdAt',
              FilterOperator.GREATER_THAN_OR_EQUAL,
              '2026-01-01',
            ),
          ],
          [
            { field: 'createdAt', direction: SortDirection.DESC },
            { field: 'id', direction: SortDirection.ASC },
          ],
          { page: 2, perPage: 5 },
        ),
      );

      expect(qb.andWhere).toHaveBeenNthCalledWith(
        1,
        `${ALIAS}.tenantId IN (:...filter0)`,
        { filter0: ['t1', 't2'] },
      );
      expect(qb.andWhere).toHaveBeenNthCalledWith(
        2,
        `${ALIAS}.channel != :filter1`,
        { filter1: 'EMAIL' },
      );
      expect(qb.andWhere).toHaveBeenNthCalledWith(
        3,
        `${ALIAS}.createdAt >= :filter2`,
        { filter2: '2026-01-01' },
      );
      expect(qb.orderBy).toHaveBeenCalledWith(`${ALIAS}.createdAt`, 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith(`${ALIAS}.id`, 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it.each(['encryptedAddress', 'unknownField', 'id; DROP TABLE x'])(
      'rejects filtering on %s before touching the query builder',
      async (field) => {
        await expect(
          repository.findByCriteria(
            new Criteria([filter(field, FilterOperator.LIKE, 'v')]),
          ),
        ).rejects.toBeInstanceOf(UnsupportedCriteriaFieldException);
        expect(ormRepository.createQueryBuilder).not.toHaveBeenCalled();
      },
    );

    it.each(['encryptedAddress', 'unknownField', 'id; DROP TABLE x'])(
      'rejects sorting on %s before touching the query builder',
      async (field) => {
        await expect(
          repository.findByCriteria(
            new Criteria([], [{ field, direction: SortDirection.ASC }]),
          ),
        ).rejects.toBeInstanceOf(UnsupportedCriteriaFieldException);
        expect(ormRepository.createQueryBuilder).not.toHaveBeenCalled();
      },
    );

    it('rejects a valid filter combined with a forbidden sort', async () => {
      await expect(
        repository.findByCriteria(
          new Criteria(
            [filter('tenantId', FilterOperator.EQUALS, 't')],
            [{ field: 'encryptedAddress', direction: SortDirection.ASC }],
          ),
        ),
      ).rejects.toBeInstanceOf(UnsupportedCriteriaFieldException);
    });
  });

  describe('save', () => {
    it('persists the mapped entity (including the envelope) and returns the mapped aggregate', async () => {
      const aggregate = buildAggregate();
      const entity = new NotificationChannelDestinationEntity();
      const savedEntity = new NotificationChannelDestinationEntity();
      mapper.toEntity.mockReturnValue(entity);
      ormRepository.save.mockResolvedValue(savedEntity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.save(aggregate);

      expect(mapper.toEntity).toHaveBeenCalledWith(aggregate);
      expect(ormRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(aggregate);
    });
  });

  describe('save (unique violation)', () => {
    it('translates a Postgres 23505 into DestinationAlreadyExistsException', async () => {
      const aggregate = buildAggregate();
      mapper.toEntity.mockReturnValue(
        new NotificationChannelDestinationEntity(),
      );
      ormRepository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], {
          code: '23505',
        } as unknown as Error),
      );

      await expect(repository.save(aggregate)).rejects.toBeInstanceOf(
        DestinationAlreadyExistsException,
      );
    });

    it('rethrows a QueryFailedError with another code unchanged', async () => {
      const aggregate = buildAggregate();
      const other = new QueryFailedError('INSERT', [], {
        code: '23502',
      } as unknown as Error);
      mapper.toEntity.mockReturnValue(
        new NotificationChannelDestinationEntity(),
      );
      ormRepository.save.mockRejectedValue(other);

      await expect(repository.save(aggregate)).rejects.toBe(other);
    });

    it('rethrows a non-database error unchanged', async () => {
      const aggregate = buildAggregate();
      const unexpected = new Error('boom');
      mapper.toEntity.mockReturnValue(
        new NotificationChannelDestinationEntity(),
      );
      ormRepository.save.mockRejectedValue(unexpected);

      await expect(repository.save(aggregate)).rejects.toBe(unexpected);
    });
  });

  describe('delete', () => {
    it('delegates to the underlying repository', async () => {
      await repository.delete('11111111-1111-4111-8111-111111111111');

      expect(ormRepository.delete).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
      );
    });
  });
});
