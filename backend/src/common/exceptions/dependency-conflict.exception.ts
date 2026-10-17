import { ConflictException } from '@nestjs/common';

export interface DependencyMatch {
  table: string;
  label: string;
  count: number;
}

export class DependencyConflictException extends ConflictException {
  constructor(
    entity: string,
    entityId: number,
    dependencies: DependencyMatch[],
  ) {
    const summary = dependencies
      .map((d) => `${d.label} (${d.count})`)
      .join(', ');
    super({
      statusCode: 409,
      error: 'DEPENDENCY_CONFLICT',
      message: `Cannot delete ${entity} #${entityId} because it is referenced in: ${summary}.`,
      entity,
      entityId,
      dependencies,
    });
  }
}
