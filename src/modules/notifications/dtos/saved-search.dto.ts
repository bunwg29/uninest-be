import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SearchListingsQueryDto } from '@modules/search/dto';

export class CreateSavedSearchDto {
  @ApiProperty({ maxLength: 100 })
  @IsString({ message: 'Tên bộ lọc phải là chuỗi' })
  @MaxLength(100, { message: 'Tên bộ lọc tối đa 100 ký tự' })
  name!: string;

  @ApiProperty({ type: SearchListingsQueryDto })
  @ValidateNested()
  @Type(() => SearchListingsQueryDto)
  criteria!: SearchListingsQueryDto;
}

export class UpdateSavedSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái bộ lọc phải là đúng hoặc sai' })
  enabled?: boolean;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Tên bộ lọc phải là chuỗi' })
  @MaxLength(100, { message: 'Tên bộ lọc tối đa 100 ký tự' })
  name?: string;
}
