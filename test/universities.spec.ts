jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { escapeLikePattern } from '../src/common/utils';
import { UniversitiesService } from '../src/modules/universities/universities.service';
import type {
  University,
  UserUniversity,
} from '../src/modules/universities/entities';

describe('UniversitiesService', () => {
  const manager = { delete: jest.fn(), insert: jest.fn() };
  const universityRepository = { findBy: jest.fn() };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };
  const service = new UniversitiesService(
    universityRepository as unknown as Repository<University>,
    {} as Repository<UserUniversity>,
    dataSource as unknown as DataSource,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lưu danh sách trường theo thứ tự và bỏ mã trùng', async () => {
    universityRepository.findBy.mockResolvedValue([
      { code: 'DDK', name: 'Bách Khoa' },
      { code: 'VKU', name: 'Việt - Hàn' },
    ]);

    await expect(
      service.replaceUserUniversities('user-1', ['ddk', 'VKU', 'DDK'], 3),
    ).resolves.toEqual([
      { code: 'DDK', name: 'Bách Khoa' },
      { code: 'VKU', name: 'Việt - Hàn' },
    ]);
    expect(manager.delete).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
    });
    expect(manager.insert).toHaveBeenCalledWith(expect.anything(), [
      { userId: 'user-1', universityCode: 'DDK', position: 0 },
      { userId: 'user-1', universityCode: 'VKU', position: 1 },
    ]);
  });

  it('sinh viên chỉ được chọn 1 trường', async () => {
    await expect(
      service.replaceUserUniversities('user-1', ['DDK', 'VKU'], 1),
    ).rejects.toThrow('Sinh viên chỉ chọn được 1 trường đại học');
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('từ chối mã trường không tồn tại', async () => {
    universityRepository.findBy.mockResolvedValue([]);

    await expect(
      service.replaceUserUniversities('user-1', ['XXX'], 3),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cho phép xoá hết trường đã chọn', async () => {
    await service.replaceUserUniversities('user-1', [], 3);

    expect(manager.delete).toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });
});

describe('escapeLikePattern', () => {
  it('thoát các ký tự đặc biệt của LIKE', () => {
    expect(escapeLikePattern(String.raw`50%_a\b`)).toBe(String.raw`50\%\_a\\b`);
  });
});
