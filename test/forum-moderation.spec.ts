import { UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

import { ForumModerationService } from '../src/modules/forum/services/forum-moderation.service';
import {
  ModerationAction,
  type ForumBannedKeyword,
} from '../src/modules/forum/entities';

describe('ForumModerationService', () => {
  const keywords = [
    { keyword: 'lừa đảo', action: ModerationAction.BLOCK },
    { keyword: 'cá độ', action: ModerationAction.WARN },
  ];
  const repository = {
    find: jest.fn().mockResolvedValue(keywords),
  } as unknown as Repository<ForumBannedKeyword>;
  const configService = { get: jest.fn() } as unknown as ConfigService;
  const service = new ForumModerationService(repository, configService);

  beforeAll(async () => {
    await service.reloadKeywords();
  });

  it('cho qua nội dung sạch', async () => {
    const result = await service.moderate({
      title: 'Tìm phòng gần Bách Khoa',
      content: 'Giá khoảng 2.500.000đ một tháng',
    });

    expect(result.isClean).toBe(true);
    expect(result.isBlocked).toBe(false);
  });

  it('chặn từ khóa cấm mức BLOCK', async () => {
    const result = await service.moderate({ content: 'Đây là trò lừa đảo' });

    expect(result.isBlocked).toBe(true);
    await expect(
      service.assertContentAllowed({ content: 'Đây là trò lừa đảo' }, true),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('yêu cầu xác nhận khi chỉ có cảnh báo', async () => {
    const content = { content: 'Rủ nhau cá độ cuối tuần' };

    await expect(
      service.assertContentAllowed(content, false),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.assertContentAllowed(content, true),
    ).resolves.toBeDefined();
  });

  it('cảnh báo khi đăng số điện thoại công khai', async () => {
    const result = await service.moderate({ content: 'Gọi 0905 123 456' });

    expect(result.hasWarnings).toBe(true);
    expect(result.isBlocked).toBe(false);
  });

  it('chặn số tài khoản ngân hàng', async () => {
    const result = await service.moderate({
      content: 'Chuyển khoản 1234567890123 nhé',
    });

    expect(result.isBlocked).toBe(true);
  });

  it('không nhầm giá tiền với số tài khoản', async () => {
    const result = await service.moderate({ content: 'Giá 2500000đ' });

    expect(result.isBlocked).toBe(false);
  });
});
