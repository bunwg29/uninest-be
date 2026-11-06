import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Cài đặt tin mới phải là đúng hoặc sai' })
  newListings?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Cài đặt tin nhắn phải là đúng hoặc sai' })
  messages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Cài đặt nhắc lịch phải là đúng hoặc sai' })
  reminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Cài đặt hệ thống phải là đúng hoặc sai' })
  system?: boolean;
}
