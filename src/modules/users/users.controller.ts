import {
  forwardRef,
  Inject,
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { R2StorageService } from '@core/storage';
import { ChangePasswordDto } from '../auth/dtos';
import { AuthService } from '../auth/services/auth.service';
import { OtpService } from '../auth/services/otp.service';
import { OtpType } from '../auth/entities/otp-code';
import { User } from './entities/user';
import { UsersService } from './users.service';
import {
  ConfirmAvatarDto,
  PresignAvatarDto,
  LandlordVerificationDto,
  ProfileResponseDto,
  RequestEmailOtpDto,
  RequestPhoneOtpDto,
  UpdateProfileDto,
  VerifyPhoneOtpDto,
} from './dtos';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['profile', 'users/me'])
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy hồ sơ cá nhân' })
  async getProfile(
    @CurrentUser('userId') userId: string,
  ): Promise<ProfileResponseDto> {
    const user = await this.usersService.findProfileById(userId);

    if (!user) {
      throw new BadRequestException('Không tìm thấy hồ sơ cá nhân');
    }

    return this.buildProfile(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleId') roleId: UserRoleType,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const address = await this.usersService.resolveAddress(dto);

    await this.usersService.update(userId, {
      ...address,
      fullName: dto.name?.trim(),
      bio: dto.bio?.trim(),
      interestedAreas: dto.interestedAreas,
    });

    if (dto.universityCodes) {
      await this.usersService.updateUniversities(
        { id: userId, roleId },
        dto.universityCodes,
      );
    }

    const user = await this.usersService.findProfileById(userId);

    if (!user) {
      throw new BadRequestException('Không tìm thấy hồ sơ cá nhân');
    }

    return this.buildProfile(user);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đổi mật khẩu và thu hồi toàn bộ phiên đăng nhập',
  })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @Post('landlord-verification')
  @Roles(UserRoleType.LANDLORD)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Chủ trọ gửi thông tin xác minh cơ bản để được phép đăng tin',
  })
  async submitLandlordVerification(
    @CurrentUser('userId') userId: string,
    @Body() dto: LandlordVerificationDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.usersService.completeLandlordVerification(
      userId,
      dto,
    );

    return this.buildProfile(user);
  }

  @Post('avatar/presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo URL tải ảnh đại diện trực tiếp lên R2' })
  async presignAvatar(
    @CurrentUser('userId') userId: string,
    @Body() dto: PresignAvatarDto,
  ) {
    const result =
      await this.r2StorageService.generatePresignedUploadUrlForImage(
        dto.fileName,
        dto.contentType,
        `avatars/${userId}`,
      );

    return {
      uploadUrl: result.uploadUrl,
      objectKey: result.key,
      expiresIn: result.expiresIn,
    };
  }

  @Post('avatar/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận ảnh đại diện đã tải lên' })
  async confirmAvatar(
    @CurrentUser('userId') userId: string,
    @Body() dto: ConfirmAvatarDto,
  ) {
    const avatarPrefix = `avatars/${userId}/`;

    if (!dto.objectKey.startsWith(avatarPrefix)) {
      throw new BadRequestException('Ảnh đại diện không thuộc tài khoản này');
    }

    await this.r2StorageService.assertValidImageObject(dto.objectKey);

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('Không tìm thấy hồ sơ cá nhân');
    }

    const oldAvatarKey = this.r2StorageService.getObjectKey(user.avatarUrl);
    const avatarUrl = this.r2StorageService.getPublicUrl(dto.objectKey);

    await this.usersService.update(userId, { avatarUrl: dto.objectKey });

    if (oldAvatarKey?.startsWith(avatarPrefix)) {
      await this.r2StorageService.deleteFile(oldAvatarKey);
    }

    return { avatarUrl };
  }

  @Post('phone/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP đổi số điện thoại' })
  async requestPhoneOtp(
    @CurrentUser('userId') userId: string,
    @Body() dto: RequestPhoneOtpDto,
  ) {
    const existingUser = await this.usersService.findByPhone(dto.newPhone);

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Số điện thoại này đã được sử dụng');
    }

    const requestId = `${userId}:${dto.newPhone}`;
    const result = await this.otpService.sendOtp(
      requestId,
      OtpType.PHONE_CHANGE,
    );

    return {
      requestId,
      expiresIn: Math.floor((result.expiresAt.getTime() - Date.now()) / 1000),
    };
  }

  @Post('phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận OTP đổi số điện thoại' })
  async verifyPhoneOtp(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyPhoneOtpDto,
  ) {
    const requestPrefix = `${userId}:`;

    if (!dto.requestId.startsWith(requestPrefix)) {
      throw new BadRequestException('Mã yêu cầu không hợp lệ');
    }

    const newPhone = dto.requestId.slice(requestPrefix.length);

    await this.otpService.verifyOtp(
      dto.requestId,
      dto.otp,
      OtpType.PHONE_CHANGE,
    );

    const existingUser = await this.usersService.findByPhone(newPhone);

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Số điện thoại này đã được sử dụng');
    }

    await this.usersService.update(userId, {
      phone: newPhone,
      phoneVerified: true,
    });

    return { phone: newPhone, phoneVerified: true };
  }

  @Post('email/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP đổi email' })
  async requestEmailOtp(
    @CurrentUser('userId') userId: string,
    @Body() dto: RequestEmailOtpDto,
  ) {
    const newEmail = dto.newEmail.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(newEmail);

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    const requestId = `${userId}:${newEmail}`;
    const result = await this.otpService.sendOtp(
      requestId,
      OtpType.EMAIL_CHANGE,
    );

    return {
      requestId,
      expiresIn: Math.floor((result.expiresAt.getTime() - Date.now()) / 1000),
    };
  }

  @Post('email/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận OTP đổi email' })
  async verifyEmailOtp(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyPhoneOtpDto,
  ) {
    const requestPrefix = `${userId}:`;

    if (!dto.requestId.startsWith(requestPrefix)) {
      throw new BadRequestException('Mã yêu cầu không hợp lệ');
    }

    const newEmail = dto.requestId.slice(requestPrefix.length).toLowerCase();

    await this.otpService.verifyOtp(
      dto.requestId,
      dto.otp,
      OtpType.EMAIL_CHANGE,
    );

    const existingUser = await this.usersService.findByEmail(newEmail);

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    await this.usersService.update(userId, { email: newEmail });

    return { email: newEmail };
  }

  private async buildProfile(user: User): Promise<ProfileResponseDto> {
    const [stats, universities] = await Promise.all([
      this.usersService.getProfileStats(user.id),
      this.usersService.getUniversities(user.id),
    ]);

    return this.mapProfile(user, stats, universities);
  }

  private mapProfile(
    user: User,
    stats: ProfileResponseDto['stats'],
    universities: ProfileResponseDto['universities'],
  ): ProfileResponseDto {
    return {
      id: user.id,
      name: user.fullName,
      avatarUrl: user.avatarUrl
        ? this.r2StorageService.getPublicUrl(user.avatarUrl)
        : null,
      phone: user.phone,
      phoneVerified:
        user.phoneVerified || (user.isVerified && Boolean(user.phone)),
      email: user.email,
      school: user.school,
      universities,
      bio: user.bio,
      provinceCode: user.provinceCode,
      provinceName: user.province?.fullName ?? null,
      wardCode: user.wardCode,
      wardName: user.ward?.fullName ?? null,
      streetAddress: user.streetAddress,
      fullAddress: user.fullAddress,
      interestedAreas: user.interestedAreas || [],
      role: user.role?.code || 'student',
      stats,
      verificationStatus:
        user.roleId === UserRoleType.LANDLORD
          ? user.landlordVerifiedAt
            ? 'verified'
            : 'pending_verification'
          : null,
      createdAt: user.createdAt,
    };
  }
}
