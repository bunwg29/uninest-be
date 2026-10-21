import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminReasonDto {
  @ApiProperty({ description: 'Lý do thực hiện thao tác', maxLength: 500 })
  @IsString({ message: 'Lý do phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do' })
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason!: string;
}

export enum ReportResolutionAction {
  DISMISS = 'dismiss',
  REMOVE = 'remove',
  WARN = 'warn',
  LOCK_USER = 'lock_user',
}

export class ResolveReportDto extends AdminReasonDto {
  @ApiProperty({
    enum: ReportResolutionAction,
    description: 'Cách xử lý báo cáo',
  })
  @IsEnum(ReportResolutionAction, {
    message: 'Cách xử lý báo cáo không hợp lệ',
  })
  action!: ReportResolutionAction;
}
