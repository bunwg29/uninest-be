import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'd3b07384d113edec49eaa6238ad5ff00...',
    description: 'Refresh Token cần làm mới',
  })
  @IsNotEmpty({ message: 'Refresh Token không được để trống' })
  @IsString()
  refreshToken!: string;

  @ApiPropertyOptional({
    example: 'device-unique-id-1234',
    description: 'Định danh thiết bị duy nhất',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}
