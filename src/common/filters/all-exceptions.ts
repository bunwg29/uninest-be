import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HTTP_STATUS_CODES } from '../constants';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof Error
        ? exception.message
        : 'Đã có lỗi hệ thống xảy ra';

    this.logger.error(
      `\x1b[31m[ERROR]\x1b[0m [${request.method}] ${request.url} ➔ ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      status: false,
      data: null,
      error:
        status === HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
          ? 'Lỗi máy chủ nội bộ'
          : 'Lỗi ngoại lệ',
      messages: message,
    });
  }
}
