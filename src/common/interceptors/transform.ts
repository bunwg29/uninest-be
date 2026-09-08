import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dtos/api-response';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseDto<T>> {
    return next.handle().pipe(
      map((data: T) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'status' in data &&
          'data' in data &&
          'messages' in data
        ) {
          const obj = data as Record<string, unknown>;

          return {
            status: Boolean(obj.status),
            data: (obj.data as T) ?? null,
            error: (obj.error as string | null) ?? null,
            messages:
              (obj.messages as string | string[]) || 'Thao tác thành công',
          };
        }

        let messages: string | string[] = 'Thao tác thành công';
        let responseData: T | null = data;

        if (
          typeof data === 'object' &&
          data !== null &&
          'messages' in data &&
          'data' in data
        ) {
          const wrapper = data as Record<string, unknown>;

          if (
            typeof wrapper.messages === 'string' ||
            Array.isArray(wrapper.messages)
          ) {
            messages = wrapper.messages as string | string[];
          }

          responseData = (wrapper.data as T) ?? null;
        }

        return {
          status: true,
          data: responseData,
          error: null,
          messages,
        };
      }),
    );
  }
}
