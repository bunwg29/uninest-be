import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportUserDto {
  @ApiProperty({ description: 'Lý do báo cáo tài khoản', maxLength: 80 })
  @IsString({ message: 'Lý do báo cáo phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng chọn lý do báo cáo' })
  @MaxLength(80, { message: 'Lý do báo cáo tối đa 80 ký tự' })
  reason!: string;

  @ApiPropertyOptional({ description: 'Thông tin bổ sung', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'Thông tin bổ sung phải là chuỗi' })
  @MaxLength(500, { message: 'Thông tin bổ sung tối đa 500 ký tự' })
  note?: string;
}
