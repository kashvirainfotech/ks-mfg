import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import {
  DependencyConflictException,
  DependencyMatch,
} from '../exceptions/dependency-conflict.exception';

export interface DependencyRelationSpec {
  table: string;
  column: string;
  label: string;
}

export interface VerifyCanDeleteParams {
  entity: string;
  entityId: number;
  relations: DependencyRelationSpec[];
}

@Injectable()
export class DependencyCheckService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Verifies that the target entityId is not referenced in any of the specified
   * child/dependent tables before allowing a DELETE operation.
   * Throws DependencyConflictException (HTTP 409) if any relation has count > 0.
   */
  async verifyCanDelete(params: VerifyCanDeleteParams): Promise<void> {
    const { entity, entityId, relations } = params;
    const matches: DependencyMatch[] = [];

    for (const rel of relations) {
      // Safe identifier validation to prevent SQL injection on table/column names
      if (
        !/^[a-zA-Z0-9_]+$/.test(rel.table) ||
        !/^[a-zA-Z0-9_]+$/.test(rel.column)
      ) {
        throw new Error(
          `Invalid table or column identifier in DependencyCheckService: ${rel.table}.${rel.column}`,
        );
      }

      const query = `SELECT COUNT(1)::int AS cnt FROM ${rel.table} WHERE ${rel.column} = $1`;
      const result = await this.pool.query<{ cnt: number }>(query, [entityId]);
      const count = result.rows[0]?.cnt ?? 0;

      if (count > 0) {
        matches.push({
          table: rel.table,
          label: rel.label,
          count,
        });
      }
    }

    if (matches.length > 0) {
      throw new DependencyConflictException(entity, entityId, matches);
    }
  }
}
