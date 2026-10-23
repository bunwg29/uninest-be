import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '@common/dtos';
import { UserRoleType } from '@common/constants';
import { ListingStatus } from '@modules/listings/entities';
import { ReportEntityType, ReportStatus } from '../entities';

export class AdminListingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ListingStatus,
    description: 'Trạng thái tin đăng',
  })
  @IsOptional()
  @IsEnum(ListingStatus, { message: 'Trạng thái tin đăng không hợp lệ' })
  status?: ListingStatus;

  @ApiPropertyOptional({ description: 'Tìm theo tiêu đề hoặc mã tin' })
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi' })
  @MaxLength(150, { message: 'Từ khoá tối đa 150 ký tự' })
  keyword?: string;
}

export class AdminReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ReportEntityType,
    description: 'Loại đối tượng bị báo cáo',
  })
  @IsOptional()
  @IsEnum(ReportEntityType, { message: 'Loại đối tượng không hợp lệ' })
  entityType?: ReportEntityType;

  @ApiPropertyOptional({
    enum: ReportStatus,
    description: 'Trạng thái báo cáo',
  })
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'Trạng thái báo cáo không hợp lệ' })
  status?: ReportStatus;
}

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRoleType, description: 'Vai trò tài khoản' })
  @IsOptional()
  @IsEnum(UserRoleType, { message: 'Vai trò tài khoản không hợp lệ' })
  @Type(() => Number)
  roleId?: UserRoleType;

  @ApiPropertyOptional({
    description: 'Tìm theo tên, email hoặc số điện thoại',
  })
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi' })
  @MaxLength(150, { message: 'Từ khoá tối đa 150 ký tự' })
  keyword?: string;
}

export class AdminAuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Mã quản trị viên thực hiện' })
  @IsOptional()
  @IsUUID('4', { message: 'Mã quản trị viên không hợp lệ' })
  actorId?: string;

  @ApiPropertyOptional({ description: 'Loại hành động' })
  @IsOptional()
  @IsString({ message: 'Loại hành động phải là chuỗi' })
  @MaxLength(80, { message: 'Loại hành động tối đa 80 ký tự' })
  action?: string;
}
