import { validate } from 'class-validator';
import { CreateBookingDto } from '../src/modules/booking/dto';
import { BookingStatus } from '../src/modules/booking/entities';
import {
  doTimeRangesOverlap,
  isBookingTransitionAllowed,
  isCancellationReasonRequired,
} from '../src/modules/booking/services/booking-policy';

describe('Quy tắc đặt lịch', () => {
  it('phát hiện khoảng thời gian chồng lấn nhưng cho phép hai lịch sát nhau', () => {
    const start = new Date('2026-10-10T08:00:00+07:00');
    const end = new Date('2026-10-10T09:00:00+07:00');

    expect(
      doTimeRangesOverlap(
        start,
        end,
        new Date('2026-10-10T08:30:00+07:00'),
        new Date('2026-10-10T09:30:00+07:00'),
      ),
    ).toBe(true);
    expect(
      doTimeRangesOverlap(
        start,
        end,
        new Date('2026-10-10T09:00:00+07:00'),
        new Date('2026-10-10T10:00:00+07:00'),
      ),
    ).toBe(false);
  });

  it('chỉ cho phép chuyển trạng thái đúng state machine', () => {
    expect(
      isBookingTransitionAllowed(
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
      ),
    ).toBe(true);
    expect(
      isBookingTransitionAllowed(BookingStatus.PENDING, BookingStatus.HOLDING),
    ).toBe(true);
    expect(
      isBookingTransitionAllowed(
        BookingStatus.EXPIRED,
        BookingStatus.CONFIRMED,
      ),
    ).toBe(false);
    expect(
      isBookingTransitionAllowed(
        BookingStatus.CANCELLED,
        BookingStatus.PENDING,
      ),
    ).toBe(false);
  });

  it('bắt buộc lý do khi còn dưới 24 giờ', () => {
    const now = new Date('2026-10-10T08:00:00+07:00');

    expect(
      isCancellationReasonRequired(
        new Date('2026-10-11T07:00:00+07:00'),
        now,
        24,
      ),
    ).toBe(true);
    expect(
      isCancellationReasonRequired(
        new Date('2026-10-11T09:00:00+07:00'),
        now,
        24,
      ),
    ).toBe(false);
  });

  it('từ chối số điện thoại và ghi chú không hợp lệ', async () => {
    const dto = Object.assign(new CreateBookingDto(), {
      listingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      startTime: '2026-10-10T08:00:00+07:00',
      phone: '123',
      note: 'a'.repeat(301),
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['phone', 'note']),
    );
  });
});
