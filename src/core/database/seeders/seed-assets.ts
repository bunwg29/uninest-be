import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { R2StorageService } from '@core/storage/r2-storage.service';
import { DEMO_ASSETS } from './demo-assets';

dotenv.config({
  path: path.resolve(__dirname, '../../../../.env'),
  quiet: true,
});

const UPLOAD_BATCH_SIZE = 3;

const loadImage = async (sourceUrl: string): Promise<Buffer> => {
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Demo image download failed: HTTP ${response.status}`);
  }

  if (!response.headers.get('content-type')?.startsWith('image/jpeg')) {
    throw new Error('Demo image source did not return a JPEG');
  }

  return Buffer.from(await response.arrayBuffer());
};

async function run(): Promise<void> {
  const config = new ConfigService();

  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('Demo asset upload is disabled in production');
  }

  const args = process.argv.slice(2);

  if (args.length !== 1 || args[0] !== '--upload') {
    console.log(
      `[Seed assets] No upload performed. ${DEMO_ASSETS.length} shared images are defined. Run npm run seed:assets -- --upload to upload missing images.`,
    );

    return;
  }

  if (!config.get<string>('R2_PUBLIC_URL')) {
    throw new Error(
      'R2_PUBLIC_URL must be configured before uploading demo assets',
    );
  }

  const storage = new R2StorageService(config);
  let created = 0;
  let existing = 0;

  for (let index = 0; index < DEMO_ASSETS.length; index += UPLOAD_BATCH_SIZE) {
    const batch = DEMO_ASSETS.slice(index, index + UPLOAD_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((asset) =>
        storage.uploadDemoImageIfMissing(asset.key, () =>
          loadImage(asset.sourceUrl),
        ),
      ),
    );

    created += results.filter((result) => result === 'created').length;
    existing += results.filter((result) => result === 'existing').length;
  }

  console.log(`[Seed assets] ${created} uploaded, ${existing} already existed`);
}

run().catch((error: unknown) => {
  console.error('[Seed assets] Failed:', error);
  process.exit(1);
});
