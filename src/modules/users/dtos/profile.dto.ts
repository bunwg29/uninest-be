import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Matches,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Xuân Hoài' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Họ và tên tối thiểu 2 ký tự' })
  @MaxLength(50, { message: 'Họ và tên tối đa 50 ký tự' })
  name?: string;

  @ApiPropertyOptional({
    example: ['DDK'],
    type: [String],
    description: 'Mã trường đại học: sinh viên tối đa 1, chủ trọ tối đa 3',
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách trường phải là mảng' })
  @ArrayMaxSize(3, { message: 'Chỉ chọn được tối đa 3 trường đại học' })
  @IsString({ each: true, message: 'Mã trường không hợp lệ' })
  @MaxLength(20, { each: true, message: 'Mã trường không hợp lệ' })
  universityCodes?: string[];

  @ApiPropertyOptional({ example: 'Sinh viên năm 3 Bách khoa' })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Giới thiệu tối đa 300 ký tự' })
  bio?: string;

  @ApiPropertyOptional({ example: '48', description: 'Mã tỉnh/thành phố' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  provinceCode?: string;

  @ApiPropertyOptional({ example: '20194', description: 'Mã phường/xã' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  wardCode?: string;

  @ApiPropertyOptional({ example: '54 Nguyễn Lương Bằng' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  streetAddress?: string;

  @ApiPropertyOptional({ example: ['Hòa Khánh', 'Khuê Mỹ'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  interestedAreas?: string[];
}

export class PresignAvatarDto {
  @ApiProperty({ example: 'avatar.png' })
  @IsNotEmpty({ message: 'Tên tệp không được để trống' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/png', enum: ['image/jpeg', 'image/png'] })
  @Matches(/^image\/(jpeg|png)$/, {
    message: 'Ảnh đại diện chỉ chấp nhận định dạng JPG hoặc PNG',
  })
  contentType!: string;

  @ApiProperty({ example: 1048576 })
  @IsInt()
  @Min(1, { message: 'Dung lượng ảnh phải lớn hơn 0' })
  @Max(100 * 1024 * 1024, { message: 'Ảnh đại diện tối đa 100MB' })
  fileSize!: number;
}

export class ConfirmAvatarDto {
  @ApiProperty({ example: 'avatars/user-id/avatar-id.png' })
  @IsNotEmpty({ message: 'objectKey không được để trống' })
  @IsString()
  @MaxLength(500)
  objectKey!: string;
}

export class RequestPhoneOtpDto {
  @ApiProperty({ example: '0905123456' })
  @IsNotEmpty({ message: 'Số điện thoại mới không được để trống' })
  @IsString()
  @Matches(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  newPhone!: string;
}

export class RequestEmailOtpDto {
  @ApiProperty({ example: 'xuanhoai@gmail.com' })
  @IsNotEmpty({ message: 'Email mới không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(150)
  newEmail!: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: 'request-id' })
  @IsNotEmpty({ message: 'Mã yêu cầu không được để trống' })
  @IsString()
  requestId!: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Matches(/^\d{6}$/, { message: 'Mã OTP phải có đúng 6 chữ số' })
  otp!: string;
}

export class ProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() avatarUrl!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiProperty() phoneVerified!: boolean;
  @ApiPropertyOptional() email!: string | null;
  @ApiPropertyOptional() school!: string | null;
  @ApiProperty({ type: [Object] }) universities!: {
    code: string;
    name: string;
  }[];
  @ApiPropertyOptional() bio!: string | null;
  @ApiPropertyOptional() provinceCode!: string | null;
  @ApiPropertyOptional() provinceName!: string | null;
  @ApiPropertyOptional() wardCode!: string | null;
  @ApiPropertyOptional() wardName!: string | null;
  @ApiPropertyOptional() streetAddress!: string | null;
  @ApiPropertyOptional() fullAddress!: string | null;
  @ApiProperty({ type: [String] }) interestedAreas!: string[];
  @ApiProperty() role!: string;
  @ApiPropertyOptional({ enum: ['pending_verification', 'verified'] })
  verificationStatus!: 'pending_verification' | 'verified' | null;
  @ApiProperty() stats!: {
    savedRooms: number;
    appointments: number;
    reviews: number;
  };
  @ApiProperty() createdAt!: Date;
}

export class LandlordVerificationDto {
  @ApiPropertyOptional({
    example: ['DDK'],
    type: [String],
    description: 'Mã trường đại học: sinh viên tối đa 1, chủ trọ tối đa 3',
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách trường phải là mảng' })
  @ArrayMaxSize(3, { message: 'Chỉ chọn được tối đa 3 trường đại học' })
  @IsString({ each: true, message: 'Mã trường không hợp lệ' })
  @MaxLength(20, { each: true, message: 'Mã trường không hợp lệ' })
  universityCodes?: string[];

  @ApiProperty({ example: '048200012345', description: 'Số CCCD/CMND' })
  @Matches(/^(\d{9}|\d{12})$/, {
    message: 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số',
  })
  identityNumber!: string;

  @ApiPropertyOptional({ example: '48' })
  @IsOptional()
  @IsString()
  provinceCode?: string;

  @ApiPropertyOptional({ example: '20194' })
  @IsOptional()
  @IsString()
  wardCode?: string;

  @ApiPropertyOptional({ example: '54 Nguyễn Lương Bằng' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  streetAddress?: string;
}
