import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let messages: string | string[] = exception.message;
    let error = exception.name;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, unknown>;

      if (typeof respObj.message === 'string') {
        messages = respObj.message;
      } else if (Array.isArray(respObj.message)) {
        messages = respObj.message.map((m) => String(m));
      }

      if (typeof respObj.error === 'string') {
        error = respObj.error;
      }
    }

    const logMessage = Array.isArray(messages) ? messages.join(', ') : messages;

    this.logger.warn(
      `\x1b[33m[WARN]\x1b[0m [${request.method}] ${request.url} ➔ ${status} (${error}) - ${logMessage}`,
    );

    response.status(status).json({
      status: false,
      data: null,
      error,
      messages,
    });
  }
}
