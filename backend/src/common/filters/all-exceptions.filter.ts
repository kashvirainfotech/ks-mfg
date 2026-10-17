import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let details: any = undefined;

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'VALIDATION_ERROR';
      message = exception.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      details = exception.issues;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        message = Array.isArray(res.message)
          ? res.message.join('; ')
          : res.message || exception.message;
        errorCode = res.error || exception.name;
        details = res.dependencies || res.details || undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled Error [${request.method} ${request.url}]: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorCode,
      message,
      details,
      correlationId: request.correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
