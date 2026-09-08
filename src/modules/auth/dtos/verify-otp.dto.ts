import {
  IsString,
  IsNotEmpty,
  Length,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpType } from '../entities/otp-code';

export class VerifyOtpDto {
  @ApiProperty({
    example: '0912345678',
    description: 'Số điện thoại hoặc Email đã nhận mã OTP',
  })
  @IsNotEmpty({ message: 'Địa chỉ nhận OTP không được để trống' })
  @IsString()
  @MaxLength(150)
  identifier!: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã OTP gồm 6 chữ số',
  })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có đúng 6 chữ số' })
  code!: string;

  @ApiPropertyOptional({
    example: OtpType.REGISTER,
    enum: OtpType,
    description: 'Mục đích xác thực OTP',
    default: OtpType.REGISTER,
  })
  @IsOptional()
  @IsEnum(OtpType, { message: 'Loại OTP không hợp lệ' })
  type: OtpType = OtpType.REGISTER;

  @ApiPropertyOptional({
    example: 'iPhone 15 Pro',
    description: 'Tên thiết bị đăng nhập',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional({
    example: 'device-unique-id-1234',
    description: 'Định danh thiết bị duy nhất',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}
