import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
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

export enum AdminSortOrder {
  NEWEST = 'newest',
  OLDEST = 'oldest',
}

export enum AdminListingFlag {
  WARNING = 'warning',
}

export enum AdminUserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

export enum AdminUserSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  NAME = 'name',
}

export class AdminListingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ListingStatus,
    description: 'Trạng thái tin đăng',
  })
  @IsOptional()
  @IsEnum(ListingStatus, { message: 'Trạng thái tin đăng không hợp lệ' })
  status?: ListingStatus;

  @ApiPropertyOptional({
    enum: AdminListingFlag,
    description: 'Lọc tin có cảnh báo tự động',
  })
  @IsOptional()
  @IsEnum(AdminListingFlag, { message: 'Bộ lọc tin đăng không hợp lệ' })
  flag?: AdminListingFlag;

  @ApiPropertyOptional({ description: 'Mã tỉnh/thành phố' })
  @IsOptional()
  @IsString({ message: 'Mã tỉnh/thành phố phải là chuỗi' })
  @MaxLength(20, { message: 'Mã tỉnh/thành phố tối đa 20 ký tự' })
  provinceCode?: string;

  @ApiPropertyOptional({
    enum: AdminSortOrder,
    description: 'Thứ tự theo thời gian gửi',
  })
  @IsOptional()
  @IsEnum(AdminSortOrder, { message: 'Thứ tự sắp xếp không hợp lệ' })
  sort?: AdminSortOrder;

  @ApiPropertyOptional({ description: 'Tìm theo tiêu đề, mã tin hoặc chủ trọ' })
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
    enum: AdminUserStatus,
    description: 'Trạng thái tài khoản',
  })
  @IsOptional()
  @IsEnum(AdminUserStatus, { message: 'Trạng thái tài khoản không hợp lệ' })
  status?: AdminUserStatus;

  @ApiPropertyOptional({ enum: AdminUserSort, description: 'Cách sắp xếp' })
  @IsOptional()
  @IsEnum(AdminUserSort, { message: 'Cách sắp xếp không hợp lệ' })
  sort?: AdminUserSort;

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

  @ApiPropertyOptional({ description: 'Tìm theo mã đối tượng hoặc chi tiết' })
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi' })
  @MaxLength(150, { message: 'Từ khoá tối đa 150 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'Từ thời điểm (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Thời điểm bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional({ description: 'Đến thời điểm (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Thời điểm kết thúc không hợp lệ' })
  to?: string;
}
