import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'MatKhauCu1' })
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  @IsString()
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ example: 'MatKhauMoi1' })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải có ít nhất một chữ số' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu mới phải có ít nhất một chữ in hoa' })
  @MaxLength(72)
  newPassword!: string;

  @ApiProperty({ example: 'MatKhauMoi1' })
  @IsNotEmpty({ message: 'Vui lòng nhập lại mật khẩu mới' })
  @IsString()
  confirmPassword!: string;
}
