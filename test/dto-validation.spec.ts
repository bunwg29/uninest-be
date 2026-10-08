import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from '../src/modules/listings/dtos/create-listing.dto';
import { ChangePasswordDto } from '../src/modules/auth/dtos/change-password.dto';
import { ResetPasswordDto } from '../src/modules/auth/dtos/reset-password.dto';

const validListing = {
  title: 'Phòng trọ gần Bách Khoa',
  roomType: 'phong_tro',
  price: 2500000,
  area: 24,
  maxOccupants: 2,
  streetAddress: 'Số 12 Lý Thường Kiệt',
  provinceCode: '48',
  wardCode: '20194',
  latitude: 16.07,
  longitude: 108.15,
  images: [{ key: 'listings/1715800000000-abc.jpg', isCover: true }],
};

const errorsOf = async (cls: new () => object, plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((error) => error.property);

describe('CreateListingDto', () => {
  it('chấp nhận dữ liệu hợp lệ', async () => {
    expect(await errorsOf(CreateListingDto, validListing)).toEqual([]);
  });

  it('từ chối tin đăng không có ảnh', async () => {
    expect(
      await errorsOf(CreateListingDto, { ...validListing, images: [] }),
    ).toContain('images');
    expect(
      await errorsOf(CreateListingDto, { ...validListing, images: undefined }),
    ).toContain('images');
  });

  it('từ chối quá 10 ảnh', async () => {
    const images = Array.from({ length: 11 }, (_, index) => ({
      key: `listings/1715800000000-img${index}.jpg`,
    }));

    expect(
      await errorsOf(CreateListingDto, { ...validListing, images }),
    ).toContain('images');
  });

  it('chấp nhận video hợp lệ và từ chối key video sai định dạng', async () => {
    expect(
      await errorsOf(CreateListingDto, {
        ...validListing,
        videoKey: 'listings/videos/1715800000000-abc.mp4',
      }),
    ).toEqual([]);
    expect(
      await errorsOf(CreateListingDto, {
        ...validListing,
        videoKey: 'listings/1715800000000-abc.mp4',
      }),
    ).toContain('videoKey');
    expect(
      await errorsOf(CreateListingDto, { ...validListing, videoKey: null }),
    ).toEqual([]);
  });

  it('từ chối loại phòng ngoài danh sách', async () => {
    expect(
      await errorsOf(CreateListingDto, { ...validListing, roomType: 'khac' }),
    ).toContain('roomType');
  });
});

describe('Quy tắc mật khẩu mới', () => {
  const cases: [string, boolean][] = [
    ['abcdefg1', true],
    ['Abcdefg1', true],
    ['abcdefgh', false],
    ['12345678', false],
    ['abc1', false],
  ];

  it.each(cases)('đổi mật khẩu: %s -> %s', async (newPassword, isValid) => {
    const errors = await errorsOf(ChangePasswordDto, {
      currentPassword: 'MatKhauCu1',
      newPassword,
      confirmPassword: newPassword,
    });

    expect(errors.includes('newPassword')).toBe(!isValid);
  });

  it.each(cases)('đặt lại mật khẩu: %s -> %s', async (newPassword, isValid) => {
    const errors = await errorsOf(ResetPasswordDto, {
      identifier: '0905123456',
      otp: '123456',
      newPassword,
    });

    expect(errors.includes('newPassword')).toBe(!isValid);
  });
});
