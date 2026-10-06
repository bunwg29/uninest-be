jest.mock('@core/storage', () => ({ R2StorageService: class {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../src/modules/users/users.service', () => ({
  UsersService: class {},
}));
jest.mock('../src/modules/locations/locations.service', () => ({
  LocationsService: class {},
}));
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import { OtpType } from '../src/modules/auth/entities/otp-code';
import type { RefreshToken } from '../src/modules/auth/entities/refresh-token';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { TokenService } from '../src/modules/auth/services/token.service';
import type { UsersService } from '../src/modules/users/users.service';

describe('TokenService phiên đăng nhập', () => {
  const refreshTokenRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn(),
  };
  const usersService = {
    getUserPermissions: jest.fn().mockResolvedValue([]),
  };
  const service = new TokenService(
    { sign: jest.fn().mockReturnValue('access') } as unknown as JwtService,
    {
      get: jest.fn((_key: string, fallback: string) => fallback),
    } as unknown as ConfigService,
    usersService as unknown as UsersService,
    refreshTokenRepository as unknown as Repository<RefreshToken>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('đăng xuất chỉ thu hồi phiên cùng thiết bị của chủ token', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
    });

    await service.revokeToken('raw-token', 'device-1');

    expect(refreshTokenRepository.update).toHaveBeenCalledWith('token-1', {
      isRevoked: true,
    });
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', deviceId: 'device-1', isRevoked: false },
      { isRevoked: true },
    );
  });

  it('đăng xuất với token không tồn tại không thu hồi phiên của người khác', async () => {
    refreshTokenRepository.findOne.mockResolvedValue(null);

    await service.revokeToken('unknown', 'device-of-victim');

    expect(refreshTokenRepository.update).not.toHaveBeenCalled();
  });

  it('từ chối làm mới khi token đã bị phiên song song xoay vòng', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', isActive: true, roleId: 0 },
    });
    refreshTokenRepository.update.mockResolvedValue({ affected: 0 });

    await expect(service.rotateRefreshToken('raw-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
  });
});

describe('AuthService.verifyOtp', () => {
  const otpService = { verifyOtp: jest.fn() };
  const usersService = {
    findByIdentifier: jest.fn(),
    getUserPermissions: jest.fn(),
  };
  const service = new AuthService(
    usersService as unknown as UsersService,
    otpService as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('không cấp token cho tài khoản đã bị vô hiệu hóa', async () => {
    otpService.verifyOtp.mockResolvedValue(true);
    usersService.findByIdentifier.mockResolvedValue({
      id: 'user-1',
      isActive: false,
      isVerified: true,
    });

    await expect(
      service.verifyOtp({
        identifier: '0912345678',
        code: '123456',
        type: OtpType.LOGIN,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('không cấp token cho OTP quên mật khẩu', async () => {
    await expect(
      service.verifyOtp({
        identifier: '0912345678',
        code: '123456',
        type: OtpType.FORGOT_PASSWORD,
      }),
    ).rejects.toThrow('Loại mã OTP này không dùng');
    expect(otpService.verifyOtp).not.toHaveBeenCalled();
  });
});
