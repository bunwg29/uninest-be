import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { PushPlatform } from '../entities';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString({ message: 'Mã thiết bị không hợp lệ' })
  @MaxLength(512, { message: 'Mã thiết bị quá dài' })
  @Matches(/^(Expo|Exponent)PushToken\[[^\]]+\]$/, {
    message: 'Mã nhận thông báo không hợp lệ',
  })
  token!: string;

  @ApiProperty({ enum: PushPlatform })
  @IsEnum(PushPlatform, { message: 'Nền tảng thiết bị không hợp lệ' })
  platform!: PushPlatform;
}
