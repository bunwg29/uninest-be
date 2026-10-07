import { DataSource } from 'typeorm';
import { Amenity, AmenityGroup } from '../../../modules/listings/entities';

export async function seedAmenities(dataSource: DataSource): Promise<void> {
  const amenityRepo = dataSource.getRepository(Amenity);

  console.log('[Amenities seeder] Seeding amenity catalog...');

  const amenitiesToSeed: {
    id: number;
    name: string;
    group: AmenityGroup;
    isActive: boolean;
  }[] = [
    { id: 1, name: 'Điều hòa', group: AmenityGroup.FURNITURE, isActive: true },
    { id: 2, name: 'Tủ lạnh', group: AmenityGroup.FURNITURE, isActive: true },
    {
      id: 3,
      name: 'Máy giặt chung',
      group: AmenityGroup.FURNITURE,
      isActive: true,
    },
    { id: 4, name: 'Gác lửng', group: AmenityGroup.FURNITURE, isActive: true },
    {
      id: 5,
      name: 'Nội thất cơ bản',
      group: AmenityGroup.FURNITURE,
      isActive: true,
    },

    {
      id: 6,
      name: 'WiFi miễn phí',
      group: AmenityGroup.FACILITY,
      isActive: true,
    },
    { id: 7, name: 'Chỗ để xe', group: AmenityGroup.FACILITY, isActive: true },
    { id: 8, name: 'Bếp chung', group: AmenityGroup.FACILITY, isActive: true },
    { id: 9, name: 'Sân phơi', group: AmenityGroup.FACILITY, isActive: true },
    { id: 10, name: 'Ban công', group: AmenityGroup.FACILITY, isActive: true },

    {
      id: 11,
      name: 'Camera an ninh',
      group: AmenityGroup.SECURITY,
      isActive: true,
    },
    {
      id: 12,
      name: 'Bảo vệ 24/7',
      group: AmenityGroup.SECURITY,
      isActive: true,
    },
    {
      id: 13,
      name: 'Khóa cửa điện tử',
      group: AmenityGroup.SECURITY,
      isActive: true,
    },

    {
      id: 14,
      name: 'WC riêng',
      group: AmenityGroup.ROOM_FEATURE,
      isActive: true,
    },
    {
      id: 15,
      name: 'Cửa sổ lớn',
      group: AmenityGroup.ROOM_FEATURE,
      isActive: true,
    },
    {
      id: 16,
      name: 'Thang máy',
      group: AmenityGroup.ROOM_FEATURE,
      isActive: true,
    },
    {
      id: 17,
      name: 'Máy nước nóng',
      group: AmenityGroup.FURNITURE,
      isActive: true,
    },
  ];

  for (const item of amenitiesToSeed) {
    await amenityRepo.upsert(
      {
        id: item.id,
        name: item.name,
        group: item.group,
        isActive: item.isActive,
      },
      ['id'],
    );
  }

  console.log(`[Amenities seeder] Seeded ${amenitiesToSeed.length} amenities.`);
}
