import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../../users/users.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthTokenDto,
  AuthUserDto,
  OtpResponseDto,
} from '../dtos';
import { OtpType } from '../entities/otp-code';
import { UserRoleType, ROLE_CODES, ROLE_NAMES } from '@common/constants';
import { User } from '../../users/entities/user';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  private mapToAuthUserDto(user: User, permissions: string[]): AuthUserDto {
    const roleCode = ROLE_CODES[user.roleId] || 'STUDENT';
    const roleName = ROLE_NAMES[user.roleId] || 'Sinh viên';

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      roleId: user.roleId,
      role: roleCode,
      roleName: roleName,
      isVerified: user.isVerified,
      isActive: user.isActive,
      permissions,
    };
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; identifier: string; requiresOtp: boolean }> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException(
        'Vui lòng cung cấp ít nhất Email hoặc Số điện thoại để đăng ký',
      );
    }

    if (dto.roleId === UserRoleType.ADMIN) {
      throw new ForbiddenException(
        'Không thể tự đăng ký tài khoản với vai trò Quản trị viên (Admin)',
      );
    }

    if (dto.email) {
      const existingEmail = await this.usersService.findByEmail(dto.email);

      if (existingEmail) {
        throw new ConflictException('Email này đã được sử dụng');
      }
    }

    if (dto.phone) {
      const existingPhone = await this.usersService.findByPhone(dto.phone);

      if (existingPhone) {
        throw new ConflictException('Số điện thoại này đã được sử dụng');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const identifier = dto.phone || dto.email!;

    await this.usersService.create({
      email: dto.email || null,
      phone: dto.phone || null,
      fullName: dto.fullName.trim(),
      passwordHash,
      roleId: dto.roleId,
      isActive: true,
      isVerified: false,
    });

    await this.otpService.sendOtp(identifier, OtpType.REGISTER);

    return {
      message: 'Đăng ký tài khoản thành công. Mã OTP xác thực đã được gửi',
      identifier,
      requiresOtp: true,
    };
  }

  async sendOtp(identifier: string, type: OtpType): Promise<OtpResponseDto> {
    const result = await this.otpService.sendOtp(identifier, type);

    return {
      identifier,
      type,
      expiresAt: result.expiresAt,
      message: 'Mã OTP xác thực đã được gửi thành công',
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    ipAddress?: string,
  ): Promise<AuthTokenDto> {
    await this.otpService.verifyOtp(dto.identifier, dto.code, dto.type);

    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản');
    }

    if (!user.isVerified) {
      await this.usersService.markVerified(user.id);
      user.isVerified = true;
    }

    const permissions = await this.usersService.getUserPermissions(user.roleId);

    const tokens = await this.tokenService.generateTokens(
      user,
      permissions,
      dto.deviceName,
      dto.deviceId,
      ipAddress,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: this.mapToAuthUserDto(user, permissions),
    };
  }

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthTokenDto> {
    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên',
      );
    }

    if (!user.isVerified) {
      const identifier = user.phone || user.email || dto.identifier;

      await this.otpService.sendOtp(identifier, OtpType.REGISTER);
      throw new ForbiddenException(
        'Tài khoản chưa được xác thực OTP. Chúng tôi đã gửi lại mã OTP, vui lòng xác thực để tiếp tục',
      );
    }

    const permissions = await this.usersService.getUserPermissions(user.roleId);

    const tokens = await this.tokenService.generateTokens(
      user,
      permissions,
      dto.deviceName,
      dto.deviceId,
      ipAddress,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: this.mapToAuthUserDto(user, permissions),
    };
  }

  async refreshToken(
    dto: RefreshTokenDto,
    ipAddress?: string,
  ): Promise<AuthTokenDto> {
    const result = await this.tokenService.rotateRefreshToken(
      dto.refreshToken,
      undefined,
      dto.deviceId,
      ipAddress,
    );

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: 'Bearer',
      user: this.mapToAuthUserDto(result.user, result.permissions),
    };
  }

  async logout(dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.tokenService.revokeToken(dto.refreshToken);
    await this.tokenService.revokeToken(dto.refreshToken, dto.deviceId);

    return { message: 'Đăng xuất thành công' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<OtpResponseDto> {
    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản với thông tin đã cung cấp',
      );
    }

    const result = await this.otpService.sendOtp(
      dto.identifier,
      OtpType.FORGOT_PASSWORD,
    );

    return {
      identifier: dto.identifier,
      type: OtpType.FORGOT_PASSWORD,
      expiresAt: result.expiresAt,
      message: 'Mã OTP khôi phục mật khẩu đã được gửi',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.otpService.verifyOtp(
      dto.identifier,
      dto.code,
      OtpType.FORGOT_PASSWORD,
    );

    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản tương ứng');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.usersService.updatePassword(user.id, passwordHash);

    await this.tokenService.revokeAllUserTokens(user.id);

    return {
      message:
        'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới',
    };
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const permissions = await this.usersService.getUserPermissions(user.roleId);

    return this.mapToAuthUserDto(user, permissions);
  }
}
