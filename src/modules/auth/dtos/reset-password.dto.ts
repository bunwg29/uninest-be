import {
  IsString,
  IsNotEmpty,
  Length,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'student@example.com hoặc 0912345678',
    description: 'Email hoặc Số điện thoại của tài khoản',
  })
  @IsNotEmpty({ message: 'Tài khoản không được để trống' })
  @IsString()
  @MaxLength(150)
  identifier!: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã OTP 6 chữ số đã nhận',
  })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có đúng 6 chữ số' })
  code!: string;

  @ApiProperty({
    example: 'NewSecret@123',
    description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới phải từ 6 ký tự trở lên' })
  @MaxLength(32)
  newPassword!: string;
}
