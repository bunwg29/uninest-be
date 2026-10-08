jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));
jest.mock('@core/storage', () => ({ R2StorageService: class {} }));
jest.mock('../src/modules/users/users.service', () => ({
  UsersService: class {},
}));
jest.mock('../src/modules/chat/services/chat.service', () => ({
  ChatService: class {},
}));
jest.mock('../src/modules/chat/services/chat-presence.service', () => ({
  ChatPresenceService: class {},
}));

import { ChatGateway } from '../src/modules/chat/gateways/chat.gateway';
import { BookingStatus } from '../src/modules/booking/entities/booking-status';

describe('Đồng bộ trạng thái đặt lịch qua socket', () => {
  const roomEmit = jest.fn();
  const server = {
    to: jest.fn(() => ({ emit: roomEmit })),
    emit: jest.fn(),
  };
  const gateway = Object.create(ChatGateway.prototype) as ChatGateway;

  Object.assign(gateway, { server });

  beforeEach(() => jest.clearAllMocks());

  const event = {
    bookingId: 'booking-1',
    listingId: 'listing-1',
    studentId: 'student-1',
    landlordId: 'landlord-1',
    actor: 'landlord' as const,
  };

  it('gửi cập nhật lịch hẹn tới cả sinh viên và chủ trọ', () => {
    gateway.broadcastBookingUpdated({
      ...event,
      from: BookingStatus.PENDING,
      to: BookingStatus.CONFIRMED,
    });

    expect(server.to).toHaveBeenCalledWith([
      expect.stringContaining('student-1'),
      expect.stringContaining('landlord-1'),
    ]);
    expect(roomEmit).toHaveBeenCalledWith(
      'booking.updated',
      expect.objectContaining({
        bookingId: 'booking-1',
        to: BookingStatus.CONFIRMED,
      }),
    );
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('phát thay đổi tình trạng phòng cho mọi người khi giữ chỗ', () => {
    gateway.broadcastBookingUpdated({
      ...event,
      from: BookingStatus.CONFIRMED,
      to: BookingStatus.HOLDING,
    });

    expect(server.emit).toHaveBeenCalledWith('listing.availability_changed', {
      listingId: 'listing-1',
    });
  });
});
