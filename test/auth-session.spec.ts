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

describe('AuthService đăng ký và đổi mật khẩu', () => {
  const otpService = { sendOtp: jest.fn() };
  const tokenService = { revokeAllUserTokens: jest.fn() };
  const usersService = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    create: jest.fn(),
    findByIdWithPassword: jest.fn(),
    updatePassword: jest.fn(),
  };
  const service = new AuthService(
    usersService as unknown as UsersService,
    otpService as never,
    tokenService as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('đăng ký tạo tài khoản và gửi OTP tới số điện thoại', async () => {
    usersService.findByPhone.mockResolvedValue(null);

    await expect(
      service.register({
        fullName: 'Nguyễn Văn A',
        phone: '0905123456',
        password: 'matkhau123',
        roleId: 0,
      } as never),
    ).resolves.toMatchObject({ identifier: '0905123456', requiresOtp: true });
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '0905123456', isVerified: false }),
    );
    expect(usersService.create.mock.calls[0][0].passwordHash).not.toBe(
      'matkhau123',
    );
    expect(otpService.sendOtp).toHaveBeenCalledWith(
      '0905123456',
      OtpType.REGISTER,
    );
  });

  it('từ chối đăng ký trùng số điện thoại', async () => {
    usersService.findByPhone.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        fullName: 'Nguyễn Văn A',
        phone: '0905123456',
        password: 'matkhau123',
        roleId: 0,
      } as never),
    ).rejects.toThrow('Số điện thoại này đã được sử dụng');
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('từ chối tự đăng ký vai trò quản trị viên', async () => {
    await expect(
      service.register({
        fullName: 'Admin',
        phone: '0905123456',
        password: 'matkhau123',
        roleId: 2,
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('đổi mật khẩu thu hồi toàn bộ phiên đăng nhập', async () => {
    const bcrypt = await import('bcryptjs');

    usersService.findByIdWithPassword.mockResolvedValue({
      id: 'user-1',
      passwordHash: await bcrypt.hash('matkhaucu1', 4),
    });

    await service.changePassword('user-1', {
      currentPassword: 'matkhaucu1',
      newPassword: 'matkhaumoi2',
      confirmPassword: 'matkhaumoi2',
    });

    expect(usersService.updatePassword).toHaveBeenCalled();
    expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
  });
});
