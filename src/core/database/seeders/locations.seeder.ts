import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Province, Ward } from '../../../modules/locations/entities';

interface RawWard {
  Code: string;
  Name: string;
  FullName: string;
  CodeName: string;
  ProvinceCode: string;
  PostalCode?: string;
}

interface RawProvince {
  Code: string;
  Name: string;
  FullName: string;
  CodeName: string;
  Wards?: RawWard[];
}

export async function seedLocations(dataSource: DataSource): Promise<void> {
  const provinceRepo = dataSource.getRepository(Province);
  const wardRepo = dataSource.getRepository(Ward);

  console.log(
    '[Locations Seeder] Bắt đầu nạp dữ liệu đơn vị hành chính Việt Nam...',
  );

  const possiblePaths = [
    path.resolve(process.cwd(), '../full_json_generated_data_vn_units.json'),
    path.resolve(process.cwd(), 'full_json_generated_data_vn_units.json'),
    path.resolve(
      __dirname,
      '../../../../../../full_json_generated_data_vn_units.json',
    ),
  ];

  let jsonPath = '';

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }

  if (!jsonPath) {
    throw new Error(
      `[Locations Seeder] Không tìm thấy file full_json_generated_data_vn_units.json tại các vị trí: ${possiblePaths.join(', ')}`,
    );
  }

  console.log(`[Locations Seeder] Đang đọc dữ liệu từ: ${jsonPath}`);

  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  const rawProvinces = JSON.parse(fileContent) as unknown as RawProvince[];

  console.log(
    `[Locations Seeder] Tìm thấy ${rawProvinces.length} tỉnh/thành phố trong dataset.`,
  );

  const provincesData: Partial<Province>[] = [];
  const wardsData: Partial<Ward>[] = [];

  for (const rawProv of rawProvinces) {
    provincesData.push({
      code: String(rawProv.Code),
      name: rawProv.Name,
      fullName: rawProv.FullName,
      codeName: rawProv.CodeName,
    });

    if (Array.isArray(rawProv.Wards)) {
      for (const rawWard of rawProv.Wards) {
        wardsData.push({
          code: String(rawWard.Code),
          name: rawWard.Name,
          fullName: rawWard.FullName,
          codeName: rawWard.CodeName,
          provinceCode: String(rawWard.ProvinceCode || rawProv.Code),
          postalCode: rawWard.PostalCode ? String(rawWard.PostalCode) : null,
        });
      }
    }
  }

  console.log(
    `[Locations Seeder] Đang lưu ${provincesData.length} tỉnh/thành phố...`,
  );

  await provinceRepo.upsert(provincesData, ['code']);

  console.log(
    `[Locations Seeder] Đã lưu thành công ${provincesData.length} tỉnh/thành phố.`,
  );
  console.log(
    `[Locations Seeder] Đang lưu ${wardsData.length} phường/xã (chia batch 500 items)...`,
  );

  const BATCH_SIZE = 500;

  for (let i = 0; i < wardsData.length; i += BATCH_SIZE) {
    const batch = wardsData.slice(i, i + BATCH_SIZE);

    await wardRepo.upsert(batch, ['code']);

    console.log(
      `   + Đã nạp batch phường/xã: ${Math.min(i + BATCH_SIZE, wardsData.length)}/${wardsData.length}`,
    );
  }

  console.log('[Locations Seeder] Hoàn thành nạp dữ liệu đơn vị hành chính!');
}
