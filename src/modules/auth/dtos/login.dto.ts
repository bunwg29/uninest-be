import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'student@example.com hoặc 0912345678',
    description: 'Email hoặc Số điện thoại đăng nhập',
  })
  @IsNotEmpty({ message: 'Tài khoản đăng nhập không được để trống' })
  @IsString()
  @MaxLength(150)
  identifier!: string;

  @ApiProperty({
    example: 'Abc@123456',
    description: 'Mật khẩu tài khoản',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  @MaxLength(32)
  password!: string;

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
    description: 'Định danh thiết bị duy nhất (cho multi-devices)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}
