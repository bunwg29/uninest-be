import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';

export class RegisterDto {
  @ApiPropertyOptional({
    example: 'student@example.com',
    description: 'Địa chỉ Email (tùy chọn nếu đã cung cấp số điện thoại)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Số điện thoại Việt Nam (10 chữ số)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ (định dạng 10 chữ số VN)',
  })
  phone?: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên người dùng',
  })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString()
  @MinLength(2, { message: 'Họ và tên tối thiểu 2 ký tự' })
  @MaxLength(70, { message: 'Họ và tên tối đa 70 ký tự' })
  fullName!: string;

  @ApiProperty({
    example: 'Abc@123456',
    description: 'Mật khẩu tài khoản (tối thiểu 6 ký tự)',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự trở lên' })
  @MaxLength(32, { message: 'Mật khẩu tối đa 32 ký tự' })
  password!: string;

  @ApiProperty({
    example: UserRoleType.STUDENT,
    description: 'Vai trò người dùng: 0 (Sinh viên), 1 (Chủ trọ)',
    enum: [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  })
  @IsNotEmpty({ message: 'Vui lòng chọn vai trò' })
  @IsIn([UserRoleType.STUDENT, UserRoleType.LANDLORD], {
    message: 'Vai trò chỉ được là 0 (Sinh viên) hoặc 1 (Chủ trọ)',
  })
  roleId!: UserRoleType;

  @ApiPropertyOptional({
    example: 'iPhone 15 Pro',
    description: 'Tên thiết bị đăng nhập (hỗ trợ quản lý đa thiết bị)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional({
    example: 'uuid-device-fingerprint',
    description: 'Mã định danh duy nhất của thiết bị',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @ApiPropertyOptional({
    example: '79',
    description: 'Mã tỉnh/thành phố',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  provinceCode?: string;

  @ApiPropertyOptional({
    example: '26734',
    description: 'Mã phường/xã',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  wardCode?: string;

  @ApiPropertyOptional({
    example: 'Số 123 Đường Nguyễn Huệ',
    description: 'Địa chỉ cụ thể (số nhà, tên đường, khu phố)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  streetAddress?: string;
}
