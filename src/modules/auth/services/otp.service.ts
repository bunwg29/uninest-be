import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { OtpCode, OtpType } from '../entities/otp-code';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepository: Repository<OtpCode>,
  ) {}

  async sendOtp(
    identifier: string,
    type: OtpType = OtpType.REGISTER,
  ): Promise<{ expiresAt: Date; code: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();

    await this.otpRepository.update(
      {
        identifier: cleanIdentifier,
        type,
        isUsed: false,
      },
      {
        isUsed: true,
      },
    );

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.OTP_TTL_MS);

    const otp = this.otpRepository.create({
      identifier: cleanIdentifier,
      code,
      type,
      expiresAt,
      isUsed: false,
      attempts: 0,
    });

    await this.otpRepository.save(otp);

    this.logger.log(
      `[OTP Service] Ma OTP gui toi [${cleanIdentifier}] (Muc dich: ${type}) la: ${code} (Het han luc: ${expiresAt.toLocaleTimeString()})`,
    );

    return { expiresAt, code };
  }

  async verifyOtp(
    identifier: string,
    code: string,
    type: OtpType = OtpType.REGISTER,
  ): Promise<boolean> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanCode = code.trim();

    const otp = await this.otpRepository.findOne({
      where: {
        identifier: cleanIdentifier,
        type,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new BadRequestException(
        'Mã OTP không hợp lệ, đã được sử dụng hoặc đã hết hạn',
      );
    }

    if (otp.attempts >= this.MAX_ATTEMPTS) {
      await this.otpRepository.update(otp.id, { isUsed: true });
      throw new BadRequestException(
        'Mã OTP đã bị vô hiệu hoá do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới',
      );
    }

    if (otp.code !== cleanCode) {
      await this.otpRepository.increment({ id: otp.id }, 'attempts', 1);
      const remaining = this.MAX_ATTEMPTS - (otp.attempts + 1);

      throw new BadRequestException(
        `Mã OTP không chính xác. Bạn còn ${remaining} lần thử`,
      );
    }

    await this.otpRepository.update(otp.id, { isUsed: true });
    this.logger.log(
      `[OTP Service] Xac thuc thanh cong OTP cho [${cleanIdentifier}] (${type})`,
    );

    return true;
  }
}
