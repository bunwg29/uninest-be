import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpType } from '../entities/otp-code';

export class SendOtpDto {
  @ApiProperty({
    example: '0912345678 hoặc student@example.com',
    description: 'Số điện thoại hoặc Email nhận mã OTP',
  })
  @IsNotEmpty({ message: 'Địa chỉ nhận OTP không được để trống' })
  @IsString()
  @MaxLength(150)
  identifier!: string;

  @ApiPropertyOptional({
    example: OtpType.REGISTER,
    enum: OtpType,
    description: 'Mục đích gửi OTP: REGISTER, LOGIN, FORGOT_PASSWORD',
    default: OtpType.REGISTER,
  })
  @IsOptional()
  @IsEnum(OtpType, { message: 'Loại OTP không hợp lệ' })
  type: OtpType = OtpType.REGISTER;
}
