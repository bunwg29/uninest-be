import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province, Ward } from './entities';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
  ) {}

  async getProvinces(): Promise<Province[]> {
    return this.provinceRepository.find({
      order: { name: 'ASC' },
    });
  }

  async getProvinceByCode(code: string): Promise<Province> {
    const province = await this.provinceRepository.findOne({
      where: { code },
    });

    if (!province) {
      throw new NotFoundException(
        `Không tìm thấy tỉnh/thành phố với mã ${code}`,
      );
    }

    return province;
  }

  async getWardsByProvinceCode(provinceCode: string): Promise<Ward[]> {
    return this.wardRepository.find({
      where: { provinceCode },
      order: { name: 'ASC' },
    });
  }

  async getWardByCode(code: string): Promise<Ward> {
    const ward = await this.wardRepository.findOne({
      where: { code },
      relations: { province: true },
    });

    if (!ward) {
      throw new NotFoundException(`Không tìm thấy phường/xã với mã ${code}`);
    }

    return ward;
  }

  async formatFullAddress(
    provinceCode: string,
    wardCode: string,
    streetAddress?: string | null,
  ): Promise<string> {
    const province = await this.getProvinceByCode(provinceCode);
    const ward = await this.getWardByCode(wardCode);

    const parts = [
      streetAddress?.trim(),
      ward.fullName,
      province.fullName,
    ].filter((part): part is string => Boolean(part && part.length > 0));

    return parts.join(', ');
  }
}
