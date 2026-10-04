import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { ForumModerationService } from '../services/forum-moderation.service';

@Injectable()
export class ForumContentModerationInterceptor implements NestInterceptor {
  constructor(private readonly moderationService: ForumModerationService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, unknown> | undefined;

    if (!body || body.isDraft === true) {
      return next.handle();
    }

    await this.moderationService.assertContentAllowed(
      this.moderationService.extractModeratedContent(body),
      body.acknowledgeWarnings === true,
    );

    return next.handle();
  }
}
