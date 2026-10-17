import { Global, Module, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const PG_POOL = 'PG_POOL';
export const DRIZZLE_DB = 'DRIZZLE_DB';
export type DrizzleDb = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString =
          configService.get<string>('DATABASE_URL') ||
          'postgresql://postgres:postgres@localhost:5432/ks_mfg_erp';
        const pool = new Pool({
          connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
        pool.on('error', (err) => {
          Logger.error(`Unexpected PostgreSQL Pool Error: ${err.message}`, 'DatabaseModule');
        });
        return pool;
      },
    },
    {
      provide: DRIZZLE_DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): DrizzleDb => {
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [PG_POOL, DRIZZLE_DB],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor() {}

  async onModuleDestroy() {
    this.logger.log('Closing database connections...');
  }
}
