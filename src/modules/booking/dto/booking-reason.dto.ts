import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BookingReasonDto {
  @ApiProperty({ maxLength: 500 })
  @IsString({ message: 'Lý do phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do' })
  @MaxLength(500, { message: 'Lý do không được vượt quá 500 ký tự' })
  reason!: string;
}
