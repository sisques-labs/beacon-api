import { join } from 'path';
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const postgresConfig = registerAs(
  'postgres',
  (): TypeOrmModuleOptions => ({
    type: (process.env.DATABASE_DRIVER ?? 'postgres') as 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_DATABASE,
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    autoLoadEntities: true,
    migrationsRun: process.env.DATABASE_MIGRATIONS_RUN !== 'false',
    // In tests, `test/helpers/test-data-source.ts` already applies
    // migrations against the test DB via `bootstrapTestDataSource()` before
    // the app boots. Also glob-loading the same `.ts` migration files here
    // races with that separate load under Node's ESM/CJS require() interop
    // ("Cannot require() ES Module ... not yet fully loaded"), so this
    // DataSource stays migration-file-free in `NODE_ENV=test`.
    migrations:
      process.env.NODE_ENV === 'test'
        ? []
        : [join(__dirname, '../../database/migrations/*{.ts,.js}')],
  }),
);
