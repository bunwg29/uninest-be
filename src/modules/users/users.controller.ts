import {
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
import { CurrentUser } from '@common/decorators';
import { JwtAuthGuard } from '@common/guards';
import { R2StorageService } from '@core/storage';
import { OtpService } from '../auth/services/otp.service';
import { OtpType } from '../auth/entities/otp-code';
import { User } from './entities/user';
import { UsersService } from './users.service';
import {
  ConfirmAvatarDto,
  PresignAvatarDto,
  ProfileResponseDto,
  RequestPhoneOtpDto,
  UpdateProfileDto,
  VerifyPhoneOtpDto,
} from './dtos';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy hồ sơ cá nhân' })
  async getProfile(
    @CurrentUser('userId') userId: string,
  ): Promise<ProfileResponseDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('Không tìm thấy hồ sơ cá nhân');
    }

    return this.mapProfile(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (dto.email) {
      const existingUser = await this.usersService.findByEmail(dto.email);

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Email này đã được sử dụng');
      }
    }

    const user = await this.usersService.update(userId, {
      fullName: dto.name?.trim(),
      email: dto.email?.trim().toLowerCase(),
      school: dto.school?.trim(),
      bio: dto.bio?.trim(),
      interestedAreas: dto.interestedAreas,
    });

    return this.mapProfile(user);
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

    if (!(await this.r2StorageService.objectExists(dto.objectKey))) {
      throw new BadRequestException('Không tìm thấy ảnh đã tải lên');
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('Không tìm thấy hồ sơ cá nhân');
    }

    const oldAvatarKey = user.avatarUrl?.split('/').slice(-3).join('/');
    const avatarUrl = this.r2StorageService.getPublicUrl(dto.objectKey);

    await this.usersService.update(userId, { avatarUrl });

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

    await this.usersService.update(userId, {
      phone: newPhone,
      phoneVerified: true,
    });

    return { phone: newPhone, phoneVerified: true };
  }

  private mapProfile(user: User): ProfileResponseDto {
    return {
      id: user.id,
      name: user.fullName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      phoneVerified:
        user.phoneVerified || (user.isVerified && Boolean(user.phone)),
      email: user.email,
      school: user.school,
      bio: user.bio,
      interestedAreas: user.interestedAreas || [],
      role: user.role?.code || 'student',
      stats: { savedRooms: 0, appointments: 0, reviews: 0 },
      createdAt: user.createdAt,
    };
  }
}
