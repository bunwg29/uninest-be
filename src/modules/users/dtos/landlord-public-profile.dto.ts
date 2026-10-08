import { ApiProperty } from '@nestjs/swagger';

export class LandlordPublicProfileDto {
  @ApiProperty({ description: 'Mã chủ trọ' })
  id!: string;

  @ApiProperty({ example: 'Cô Nguyễn Thị Lệ Hà' })
  fullName!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Chủ trọ đã hoàn tất xác minh' })
  isVerified!: boolean;

  @ApiProperty({ description: 'Thời điểm tham gia UniNest' })
  joinedAt!: Date;

  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({
    type: [Object],
    description: 'Các trường đại học gần trọ mà chủ trọ đã chọn',
  })
  universities!: { code: string; name: string }[];

  @ApiProperty({ description: 'Số tin đang hiển thị' })
  activeListingCount!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Số điện thoại, chỉ trả về cho chính chủ trọ hoặc người đã liên hệ (nhắn tin hoặc đặt lịch)',
  })
  phone!: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Điểm đánh giá trung bình, chưa có dữ liệu cho tới khi ra mắt đánh giá',
  })
  averageRating!: number | null;

  @ApiProperty({ description: 'Số lượt đánh giá' })
  reviewCount!: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Thời gian phản hồi trung bình (phút), chưa có dữ liệu',
  })
  responseMinutes!: number | null;
}
