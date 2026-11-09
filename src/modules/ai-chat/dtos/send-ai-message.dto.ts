import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RoomType } from '@modules/listings/entities/room-type';
import { AI_CHAT_LIMITS } from '../constants';

export class AiChatCriteriaDto {
  @ApiPropertyOptional({ example: 1500000, description: 'Giá tối thiểu (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá tối thiểu phải là số nguyên' })
  @Min(0, { message: 'Giá tối thiểu không được âm' })
  minPrice?: number;

  @ApiPropertyOptional({ example: 2500000, description: 'Giá tối đa (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá tối đa phải là số nguyên' })
  @Min(1, { message: 'Giá tối đa phải lớn hơn 0' })
  maxPrice?: number;

  @ApiPropertyOptional({ example: 18, description: 'Diện tích tối thiểu (m²)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Diện tích tối thiểu phải là số nguyên' })
  @Min(1, { message: 'Diện tích tối thiểu phải lớn hơn 0' })
  minArea?: number;

  @ApiPropertyOptional({ enum: RoomType, isArray: true })
  @IsOptional()
  @IsArray({ message: 'Loại phòng phải là danh sách' })
  @ArrayMaxSize(6, { message: 'Tối đa 6 loại phòng' })
  @IsEnum(RoomType, { each: true, message: 'Loại phòng không hợp lệ' })
  roomTypes?: RoomType[];

  @ApiPropertyOptional({ type: [Number], example: [7, 8] })
  @IsOptional()
  @IsArray({ message: 'Tiện ích phải là danh sách' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 tiện ích' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mã tiện ích không hợp lệ' })
  amenityIds?: number[];

  @ApiPropertyOptional({ example: 'DDK', description: 'Mã trường tham chiếu' })
  @IsOptional()
  @IsString({ message: 'Mã trường phải là chuỗi' })
  @MaxLength(20, { message: 'Mã trường tối đa 20 ký tự' })
  universityCode?: string;

  @ApiPropertyOptional({ example: '48', description: 'Mã tỉnh/thành phố' })
  @IsOptional()
  @IsString({ message: 'Mã tỉnh/thành phố phải là chuỗi' })
  @MaxLength(20, { message: 'Mã tỉnh/thành phố tối đa 20 ký tự' })
  provinceCode?: string;

  @ApiPropertyOptional({ description: 'Mã phường/xã' })
  @IsOptional()
  @IsString({ message: 'Mã phường/xã phải là chuỗi' })
  @MaxLength(20, { message: 'Mã phường/xã tối đa 20 ký tự' })
  wardCode?: string;
}

export class SendAiMessageDto {
  @ApiProperty({
    example: 'Tìm phòng dưới 2 triệu 5 gần Bách khoa Đà Nẵng, có chỗ để xe',
  })
  @IsString({ message: 'Nội dung phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung' })
  @MaxLength(AI_CHAT_LIMITS.MESSAGE_MAX_LENGTH, {
    message: `Nội dung tối đa ${AI_CHAT_LIMITS.MESSAGE_MAX_LENGTH} ký tự`,
  })
  message!: string;

  @ApiPropertyOptional({ description: 'Mã cuộc trò chuyện để giữ ngữ cảnh' })
  @IsOptional()
  @IsUUID('4', { message: 'Mã cuộc trò chuyện không hợp lệ' })
  conversationId?: string;

  @ApiPropertyOptional({
    type: AiChatCriteriaDto,
    description:
      'Tiêu chí sinh viên đã sửa (AI-07), thay cho tiêu chí trích xuất',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiChatCriteriaDto)
  criteria?: AiChatCriteriaDto;
}
