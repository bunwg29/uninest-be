import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';

export class AuthUserDto {
  @ApiProperty({ example: 'b56740ea-9bf8-4680-baea-c9fb23058bfe' })
  id!: string;

  @ApiPropertyOptional({ example: 'student@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ example: '0912345678' })
  phone!: string | null;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://pub-r2.dev/avatar.jpg' })
  avatarUrl!: string | null;

  @ApiProperty({ example: UserRoleType.STUDENT, enum: UserRoleType })
  roleId!: UserRoleType;

  @ApiProperty({ example: 'STUDENT' })
  role!: string;

  @ApiProperty({ example: 'Sinh viên' })
  roleName!: string;

  @ApiProperty({ example: true })
  isVerified!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '79' })
  provinceCode?: string | null;

  @ApiPropertyOptional({ example: '26734' })
  wardCode?: string | null;

  @ApiPropertyOptional({ example: 'Số 123 Đường Nguyễn Huệ' })
  streetAddress?: string | null;

  @ApiPropertyOptional({
    example: 'Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Thành phố Hồ Chí Minh',
  })
  fullAddress?: string | null;

  @ApiProperty({
    example: ['listings:read', 'bookings:create', 'users:me'],
    type: [String],
  })
  permissions!: string[];
}

export class AuthTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Access Token (JWT) dùng để xác thực API',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'd3b07384d113edec49eaa6238ad5ff00...',
    description: 'Refresh Token dùng để lấy Access Token mới',
  })
  refreshToken!: string;

  @ApiProperty({
    example: 900,
    description: 'Thời gian sống của Access Token tính bằng giây (15 phút)',
  })
  expiresIn!: number;

  @ApiProperty({
    example: 'Bearer',
    description: 'Loại token',
  })
  tokenType!: string;

  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;
}

export class OtpResponseDto {
  @ApiProperty({ example: '0912345678' })
  identifier!: string;

  @ApiProperty({ example: 'REGISTER' })
  type!: string;

  @ApiProperty({ example: '2026-09-08T03:00:00.000Z' })
  expiresAt!: Date;

  @ApiProperty({ example: 'Mã xác thực OTP đã được gửi thành công' })
  message!: string;
}
