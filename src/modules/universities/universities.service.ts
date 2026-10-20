import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { escapeLikePattern } from '@common/utils';
import { UniversitiesQueryDto } from './dtos';
import { University, UserUniversity } from './entities';

export interface UniversitySummary {
  code: string;
  name: string;
}

@Injectable()
export class UniversitiesService {
  constructor(
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
    @InjectRepository(UserUniversity)
    private readonly userUniversityRepository: Repository<UserUniversity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async search(query: UniversitiesQueryDto): Promise<UniversitySummary[]> {
    const builder = this.universityRepository
      .createQueryBuilder('university')
      .select(['university.code', 'university.name'])
      .orderBy('university.name', 'ASC')
      .take(query.limit);

    if (query.keyword) {
      builder.where(
        '(uninest_unaccent(university.name) ILIKE uninest_unaccent(:keyword) OR university.code ILIKE :codePrefix)',
        {
          keyword: `%${escapeLikePattern(query.keyword)}%`,
          codePrefix: `${escapeLikePattern(query.keyword)}%`,
        },
      );
    }

    return builder.getMany();
  }

  async assertCodesExist(codes: string[]): Promise<University[]> {
    const uniqueCodes = this.normalizeCodes(codes);

    if (uniqueCodes.length === 0) return [];

    const universities = await this.universityRepository.findBy({
      code: In(uniqueCodes),
    });

    if (universities.length !== uniqueCodes.length) {
      throw new BadRequestException(
        'Một hoặc nhiều trường đại học không tồn tại',
      );
    }

    const byCode = new Map(universities.map((item) => [item.code, item]));

    return uniqueCodes.map((code) => byCode.get(code) as University);
  }

  normalizeCodes(codes: string[]): string[] {
    return [...new Set(codes.map((code) => code.trim().toUpperCase()))];
  }

  async getUserUniversities(userId: string): Promise<UniversitySummary[]> {
    const rows = await this.userUniversityRepository.find({
      where: { userId },
      relations: { university: true },
      order: { position: 'ASC' },
    });

    return rows.map((row) => ({
      code: row.university.code,
      name: row.university.name,
    }));
  }

  async replaceUserUniversities(
    userId: string,
    codes: string[],
    maxCount: number,
  ): Promise<UniversitySummary[]> {
    const uniqueCodes = [
      ...new Set(codes.map((code) => code.trim().toUpperCase())),
    ];

    if (uniqueCodes.length > maxCount) {
      throw new BadRequestException(
        maxCount === 1
          ? 'Sinh viên chỉ chọn được 1 trường đại học'
          : `Chỉ chọn được tối đa ${maxCount} trường đại học`,
      );
    }

    const universities = uniqueCodes.length
      ? await this.universityRepository.findBy({ code: In(uniqueCodes) })
      : [];

    if (universities.length !== uniqueCodes.length) {
      throw new BadRequestException(
        'Một hoặc nhiều trường đại học không tồn tại',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserUniversity, { userId });

      if (uniqueCodes.length > 0) {
        await manager.insert(
          UserUniversity,
          uniqueCodes.map((universityCode, position) => ({
            userId,
            universityCode,
            position,
          })),
        );
      }
    });

    const namesByCode = new Map(
      universities.map((item) => [item.code, item.name]),
    );

    return uniqueCodes.map((code) => ({
      code,
      name: namesByCode.get(code) ?? code,
    }));
  }
}
