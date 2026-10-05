import type { Repository } from 'typeorm';
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BookingExpirationService } from '../src/modules/booking/services/booking-expiration.service';
import type { Booking, BookingEvent } from '../src/modules/booking/entities';

describe('BookingExpirationService', () => {
  const execute = jest.fn();
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute,
  };
  const bookingRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  } as unknown as Repository<Booking>;
  const eventRepository = {
    insert: jest.fn(),
  } as unknown as Repository<BookingEvent>;
  const service = new BookingExpirationService(
    bookingRepository,
    eventRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('hết hạn các lịch quá hạn và ghi sự kiện đúng một lần', async () => {
    (bookingRepository.find as jest.Mock).mockResolvedValue([
      { id: 'booking-1' },
    ]);
    execute.mockResolvedValue({ affected: 1, raw: [{ id: 'booking-1' }] });

    await expect(service.handleExpiredBookings()).resolves.toBe(1);
    expect(eventRepository.insert).toHaveBeenCalledTimes(1);
  });

  it('chạy lặp an toàn khi không còn lịch quá hạn', async () => {
    (bookingRepository.find as jest.Mock).mockResolvedValue([]);

    await expect(service.handleExpiredBookings()).resolves.toBe(0);
    expect(bookingRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(eventRepository.insert).not.toHaveBeenCalled();
  });
});
