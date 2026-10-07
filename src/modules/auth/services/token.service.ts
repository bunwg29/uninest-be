import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RefreshToken } from '../entities/refresh-token';
import { User } from '../../users/entities/user';
import { UsersService } from '../../users/users.service';
import { ROLE_CODES, UserRoleType } from '@common/constants';

export interface JwtPayload {
  sub: string;
  email: string | null;
  phone: string | null;
  roleId: UserRoleType;
  role: string;
  permissions: string[];
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly ACCESS_EXPIRES_IN_SEC: number = 60 * 60;
  private readonly REFRESH_EXPIRES_IN_DAYS: number = 30;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokens(
    user: User,
    permissions: string[],
    deviceName?: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      role: ROLE_CODES[user.roleId] || 'STUDENT',
      permissions,
    };

    const accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'uninest_dev_access_secret_key_32bytes!',
    );

    const accessToken = this.jwtService.sign(
      payload as unknown as Record<string, unknown>,
      {
        secret: accessSecret,
        expiresIn: this.ACCESS_EXPIRES_IN_SEC,
      },
    );

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_EXPIRES_IN_DAYS);

    if (deviceId) {
      await this.refreshTokenRepository.update(
        { userId: user.id, deviceId, isRevoked: false },
        { isRevoked: true },
      );
    }

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      deviceName: deviceName || null,
      deviceId: deviceId || null,
      ipAddress: ipAddress || null,
      expiresAt,
      isRevoked: false,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.ACCESS_EXPIRES_IN_SEC,
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    deviceName?: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<{
    user: User;
    permissions: string[];
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const existingToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: {
        user: {
          role: true,
        },
      },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Refresh Token không tồn tại');
    }

    if (existingToken.isRevoked) {
      this.logger.warn(
        `[Security] Reuse of a revoked refresh token detected for user: ${existingToken.userId}. Revoking all sessions!`,
      );
      await this.revokeAllUserTokens(existingToken.userId);
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc phát hiện bất thường. Vui lòng đăng nhập lại',
      );
    }

    if (existingToken.expiresAt < new Date()) {
      await this.refreshTokenRepository.update(existingToken.id, {
        isRevoked: true,
      });
      throw new UnauthorizedException(
        'Refresh Token đã hết hạn. Vui lòng đăng nhập lại',
      );
    }

    const user = existingToken.user;

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản đã bị vô hiệu hóa hoặc không tồn tại',
      );
    }

    const rotation = await this.refreshTokenRepository.update(
      { id: existingToken.id, isRevoked: false },
      { isRevoked: true },
    );

    if (!rotation.affected) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã được làm mới ở nơi khác. Vui lòng thử lại',
      );
    }

    const permissions = await this.usersService.getUserPermissions(user.roleId);

    const newTokens = await this.generateTokens(
      user,
      permissions,
      deviceName || existingToken.deviceName || undefined,
      deviceId || existingToken.deviceId || undefined,
      ipAddress || existingToken.ipAddress || undefined,
    );

    return {
      user,
      permissions,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: newTokens.expiresIn,
    };
  }

  async revokeToken(rawRefreshToken: string, deviceId?: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const existingToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      select: { id: true, userId: true },
    });

    if (!existingToken) {
      return;
    }

    await this.refreshTokenRepository.update(existingToken.id, {
      isRevoked: true,
    });

    if (deviceId) {
      await this.refreshTokenRepository.update(
        { userId: existingToken.userId, deviceId, isRevoked: false },
        { isRevoked: true },
      );
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  async revokeOtherUserTokens(
    userId: string,
    deviceId?: string,
  ): Promise<void> {
    const activeTokens = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
    });

    const tokensToRevoke = activeTokens.filter(
      (token) => !deviceId || token.deviceId !== deviceId,
    );

    for (const token of tokensToRevoke) {
      token.isRevoked = true;
    }

    if (tokensToRevoke.length > 0) {
      await this.refreshTokenRepository.save(tokensToRevoke);
    }
  }
}
