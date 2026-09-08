import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'student@example.com hoặc 0912345678',
    description: 'Email hoặc Số điện thoại đã đăng ký để nhận mã khôi phục',
  })
  @IsNotEmpty({ message: 'Vui lòng cung cấp email hoặc số điện thoại' })
  @IsString()
  @MaxLength(150)
  identifier!: string;
}
