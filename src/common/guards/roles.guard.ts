import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles';
import { UserRoleType } from '../constants';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { roleId?: UserRoleType; userId?: string };
      path?: string;
      method?: string;
    }>();
    const user = request.user;

    if (!user || user.roleId === undefined) {
      throw new ForbiddenException(
        'Không xác định được vai trò người dùng trong phiên làm việc',
      );
    }

    const hasRole = requiredRoles.includes(user.roleId);

    if (!hasRole) {
      if (requiredRoles.includes(UserRoleType.ADMIN)) {
        this.logger.warn(
          `Forbidden admin access: ${request.method ?? 'UNKNOWN'} ${request.path ?? ''} actor=${user.userId ?? 'unknown'} role=${user.roleId}`,
        );
      }

      throw new ForbiddenException(
        'Bạn không có vai trò phù hợp để thực hiện thao tác này',
      );
    }

    return true;
  }
}
