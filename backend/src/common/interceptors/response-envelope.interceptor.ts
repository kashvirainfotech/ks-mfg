import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest();
    const response = httpCtx.getResponse();

    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === 'object' && 'success' in body) {
          return body;
        }

        const isPaginated =
          body &&
          typeof body === 'object' &&
          'items' in body &&
          'meta' in body;

        return {
          success: true,
          statusCode: response.statusCode || 200,
          message: body?.message || 'OK',
          data: isPaginated ? body.items : (body?.data ?? body),
          meta: isPaginated ? body.meta : (body?.meta ?? undefined),
          correlationId: request.correlationId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
