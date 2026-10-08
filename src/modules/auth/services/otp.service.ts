import { createHash, randomInt } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpCode, OtpType } from '../entities/otp-code';
import { Environment } from '@core/config/env.schema';

const OTP_RULES = {
  TTL_MS: 5 * 60 * 1000,
  MAX_ATTEMPTS: 5,
  LOCK_MS: 60 * 1000,
} as const;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepository: Repository<OtpCode>,
  ) {}

  async sendOtp(
    identifier: string,
    type: OtpType = OtpType.REGISTER,
  ): Promise<{ expiresAt: Date; code: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const latestOtp = await this.otpRepository.findOne({
      where: { identifier: cleanIdentifier, type },
      order: { createdAt: 'DESC' },
    });

    if (latestOtp) {
      const resendAvailableAt = Math.max(
        latestOtp.createdAt.getTime() + OTP_RULES.LOCK_MS,
        latestOtp.lockedUntil?.getTime() ?? 0,
      );

      this.assertNotLocked(resendAvailableAt, 'gửi lại mã OTP');
    }

    await this.otpRepository.update(
      { identifier: cleanIdentifier, type, isUsed: false },
      { isUsed: true },
    );

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_RULES.TTL_MS);

    await this.otpRepository.save(
      this.otpRepository.create({
        identifier: cleanIdentifier,
        codeHash: this.hashCode(cleanIdentifier, code),
        type,
        expiresAt,
        isUsed: false,
        attempts: 0,
        lockedUntil: null,
      }),
    );

    const codeForLog =
      process.env.NODE_ENV === Environment.PRODUCTION ? '******' : code;

    this.logger.log(
      `[OTP Service] OTP sent to [${cleanIdentifier}] (purpose: ${type}): ${codeForLog} (expires at: ${expiresAt.toLocaleTimeString()})`,
    );

    return { expiresAt, code };
  }

  async verifyOtp(
    identifier: string,
    code: string,
    type: OtpType = OtpType.REGISTER,
  ): Promise<boolean> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const otp = await this.otpRepository.findOne({
      where: { identifier: cleanIdentifier, type, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new BadRequestException(
        'Mã OTP không hợp lệ hoặc đã được sử dụng. Vui lòng yêu cầu mã mới',
      );
    }

    this.assertNotLocked(otp.lockedUntil?.getTime() ?? 0, 'xác thực OTP');

    if (otp.expiresAt.getTime() <= Date.now()) {
      await this.otpRepository.update(otp.id, { isUsed: true });
      throw new BadRequestException(
        'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới',
      );
    }

    if (otp.codeHash !== this.hashCode(cleanIdentifier, code.trim())) {
      const attempts = otp.attempts + 1;

      if (attempts >= OTP_RULES.MAX_ATTEMPTS) {
        await this.otpRepository.update(otp.id, {
          attempts,
          isUsed: true,
          lockedUntil: new Date(Date.now() + OTP_RULES.LOCK_MS),
        });
        throw new BadRequestException(
          'Bạn đã nhập sai quá 5 lần. Vui lòng chờ 60 giây rồi yêu cầu gửi lại mã mới',
        );
      }

      await this.otpRepository.update(otp.id, { attempts });
      throw new BadRequestException(
        `Mã OTP không chính xác. Bạn còn ${OTP_RULES.MAX_ATTEMPTS - attempts} lần thử`,
      );
    }

    await this.otpRepository.update(otp.id, { isUsed: true });
    this.logger.log(
      `[OTP Service] OTP verified for [${cleanIdentifier}] (${type})`,
    );

    return true;
  }

  private assertNotLocked(availableAtMs: number, action: string): void {
    const remainingMs = availableAtMs - Date.now();

    if (remainingMs > 0) {
      throw new HttpException(
        `Vui lòng chờ ${Math.ceil(remainingMs / 1000)} giây để ${action}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hashCode(identifier: string, code: string): string {
    return createHash('sha256').update(`${identifier}:${code}`).digest('hex');
  }
}
