import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './services/auth.service';
import {
  RegisterDto,
  LoginDto,
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthTokenDto,
  AuthUserDto,
  OtpResponseDto,
  ChangePasswordDto,
} from './dtos';
import { Public, CurrentUser } from '@common/decorators';
import { JwtAuthGuard } from '@common/guards';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới (Sinh viên hoặc Chủ trọ)',
    description:
      'Tạo tài khoản mới và tự động gửi mã OTP xác thực tới Email hoặc Số điện thoại',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Đăng ký tài khoản thành công',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập tài khoản',
    description:
      'Đăng nhập bằng Email/SĐT và mật khẩu, trả về Access Token và Refresh Token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuthTokenDto,
    description: 'Đăng nhập thành công',
  })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;

    return this.authService.login(dto, ipAddress);
  }

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi hoặc gửi lại mã xác thực OTP',
    description:
      'Sinh mã OTP ngẫu nhiên 6 chữ số (TTL 5 phút) gửi tới email hoặc số điện thoại',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OtpResponseDto,
    description: 'Gửi mã OTP thành công',
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.identifier, dto.type);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác thực mã OTP',
    description:
      'Kiểm tra mã OTP 6 chữ số để kích hoạt tài khoản và cấp phát token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuthTokenDto,
    description: 'Xác thực OTP thành công',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;

    return this.authService.verifyOtp(dto, ipAddress);
  }

  @Public()
  @Post(['refresh', 'refresh-token'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới Access Token bằng Refresh Token',
    description:
      'Xoay vòng Refresh Token (Token Rotation) và cấp cặp token mới cho phiên làm việc',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuthTokenDto,
    description: 'Làm mới token thành công',
  })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;

    return this.authService.refreshToken(dto, ipAddress);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất tài khoản',
    description: 'Thu hồi Refresh Token trong cơ sở dữ liệu để kết thúc phiên',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đăng xuất thành công',
  })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Yêu cầu khôi phục mật khẩu',
    description: 'Gửi mã OTP 6 chữ số tới Email/SĐT để khôi phục mật khẩu',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OtpResponseDto,
    description: 'Mã OTP khôi phục mật khẩu đã được gửi',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đặt lại mật khẩu mới',
    description: 'Xác nhận mã OTP và cập nhật mật khẩu mới cho tài khoản',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đặt lại mật khẩu thành công',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản hiện tại',
    description:
      'Trả về thông tin chi tiết, vai trò và danh sách quyền hạn (permissions) của user đang đăng nhập',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuthUserDto,
    description: 'Thông tin tài khoản hợp lệ',
  })
  async getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu tài khoản' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(
      userId,
      dto,
      req.headers['x-device-id']?.toString(),
    );
  }
}
