import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles';
import { UserRoleType } from '../constants';

@Injectable()
export class RolesGuard implements CanActivate {
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
      user?: { roleId?: UserRoleType };
    }>();
    const user = request.user;

    if (!user || user.roleId === undefined) {
      throw new ForbiddenException(
        'Không xác định được vai trò người dùng trong phiên làm việc',
      );
    }

    const hasRole = requiredRoles.includes(user.roleId);

    if (!hasRole) {
      throw new ForbiddenException(
        'Bạn không có vai trò phù hợp để thực hiện thao tác này',
      );
    }

    return true;
  }
}
