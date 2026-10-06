import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
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
    description: 'Mật khẩu mới (tối thiểu 8 ký tự, có chữ số và chữ in hoa)',
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải từ 8 ký tự trở lên' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải có ít nhất một chữ số' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu mới phải có ít nhất một chữ in hoa' })
  @MaxLength(32)
  newPassword!: string;
}
