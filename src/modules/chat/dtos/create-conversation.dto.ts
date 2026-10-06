import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Mã tin đăng mà sinh viên muốn trao đổi với chủ trọ',
    example: '3f1c2a4e-8b7d-4c5a-9e21-6a1d2b3c4d5e',
  })
  @IsUUID('4', { message: 'Mã tin đăng không hợp lệ' })
  listingId!: string;

  @ApiPropertyOptional({
    description:
      'Mã sinh viên cần nhắn tin. Chỉ chủ trọ sử dụng, và sinh viên đó phải từng đặt lịch xem phòng của tin này',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Mã sinh viên không hợp lệ' })
  studentId?: string;
}
