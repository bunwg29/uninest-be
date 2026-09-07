import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  MAGENTA: '\x1b[35m',
  BLUE: '\x1b[34m',
} as const;

function formatMethod(method: string): string {
  switch (method) {
    case 'GET':
      return `${ANSI.GREEN}${ANSI.BOLD}GET   ${ANSI.RESET}`;
    case 'POST':
      return `${ANSI.YELLOW}${ANSI.BOLD}POST  ${ANSI.RESET}`;
    case 'PUT':
      return `${ANSI.BLUE}${ANSI.BOLD}PUT   ${ANSI.RESET}`;
    case 'PATCH':
      return `${ANSI.CYAN}${ANSI.BOLD}PATCH ${ANSI.RESET}`;
    case 'DELETE':
      return `${ANSI.RED}${ANSI.BOLD}DELETE${ANSI.RESET}`;
    default:
      return `${ANSI.BOLD}${method.padEnd(6)}${ANSI.RESET}`;
  }
}

function formatStatus(status: number): string {
  if (status >= 500) {
    return `${ANSI.RED}${ANSI.BOLD}${status}${ANSI.RESET}`;
  }

  if (status >= 400) {
    return `${ANSI.YELLOW}${ANSI.BOLD}${status}${ANSI.RESET}`;
  }

  if (status >= 300) {
    return `${ANSI.CYAN}${status}${ANSI.RESET}`;
  }

  return `${ANSI.GREEN}${ANSI.BOLD}${status}${ANSI.RESET}`;
}

function formatDuration(ms: number): string {
  if (ms >= 500) {
    return `${ANSI.RED}+${ms}ms${ANSI.RESET}`;
  }

  if (ms >= 100) {
    return `${ANSI.YELLOW}+${ms}ms${ANSI.RESET}`;
  }

  return `${ANSI.GREEN}+${ms}ms${ANSI.RESET}`;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        const formattedMethod = formatMethod(method);
        const formattedStatus = formatStatus(statusCode);
        const formattedTime = formatDuration(duration);

        this.logger.log(
          `${formattedMethod} ${url} ➔ ${formattedStatus} (${formattedTime})`,
        );
      }),
    );
  }
}
