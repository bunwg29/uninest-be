import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { R2StorageService } from '@core/storage/r2-storage.service';
import {
  DEMO_ASSETS,
  DEMO_ASSET_COUNT,
  DEMO_ASSET_SEARCH_QUERIES,
} from './demo-assets';

dotenv.config({
  path: path.resolve(__dirname, '../../../../.env'),
  quiet: true,
});

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const PEXELS_PAGE_SIZE = 80;
const PEXELS_MAX_PAGES_PER_QUERY = 5;
const UPLOAD_BATCH_SIZE = 5;
const REQUEST_TIMEOUT_MS = 30_000;

interface PexelsPhoto {
  id: number;
  src: { large: string };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

const fetchPexelsPage = async (
  apiKey: string,
  query: string,
  page: number,
): Promise<PexelsPhoto[]> => {
  const url = `${PEXELS_SEARCH_URL}?${new URLSearchParams({
    query,
    per_page: String(PEXELS_PAGE_SIZE),
    page: String(page),
    orientation: 'landscape',
  })}`;
  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Pexels search failed: HTTP ${response.status}`);
  }

  return ((await response.json()) as PexelsSearchResponse).photos;
};

const collectPhotoUrls = async (apiKey: string): Promise<string[]> => {
  const urls = new Map<number, string>();

  for (const query of DEMO_ASSET_SEARCH_QUERIES) {
    for (let page = 1; page <= PEXELS_MAX_PAGES_PER_QUERY; page += 1) {
      if (urls.size >= DEMO_ASSET_COUNT) return [...urls.values()];

      const photos = await fetchPexelsPage(apiKey, query, page);

      if (photos.length === 0) break;

      photos.forEach((photo) => {
        if (urls.size < DEMO_ASSET_COUNT) urls.set(photo.id, photo.src.large);
      });
    }
  }

  if (urls.size < DEMO_ASSET_COUNT) {
    throw new Error(
      `Pexels returned only ${urls.size} unique photos, ${DEMO_ASSET_COUNT} required`,
    );
  }

  return [...urls.values()];
};

const downloadImage = async (sourceUrl: string): Promise<Buffer> => {
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

  const apiKey = config.get<string>('PEXELS_API_KEY');

  if (!apiKey) {
    throw new Error('PEXELS_API_KEY must be configured to upload demo assets');
  }

  if (!config.get<string>('R2_PUBLIC_URL')) {
    throw new Error(
      'R2_PUBLIC_URL must be configured before uploading demo assets',
    );
  }

  const storage = new R2StorageService(config);
  let photoUrls: Promise<string[]> | null = null;
  const getPhotoUrls = () => (photoUrls ??= collectPhotoUrls(apiKey));
  let created = 0;
  let existing = 0;

  for (let index = 0; index < DEMO_ASSETS.length; index += UPLOAD_BATCH_SIZE) {
    const results = await Promise.all(
      DEMO_ASSETS.slice(index, index + UPLOAD_BATCH_SIZE).map(
        async (asset, offset) =>
          storage.uploadDemoImageIfMissing(asset.key, async () => {
            const urls = await getPhotoUrls();

            return downloadImage(urls[index + offset]);
          }),
      ),
    );

    created += results.filter((result) => result === 'created').length;
    existing += results.filter((result) => result === 'existing').length;

    console.log(
      `[Seed assets] ${Math.min(index + UPLOAD_BATCH_SIZE, DEMO_ASSETS.length)}/${DEMO_ASSETS.length}`,
    );
  }

  console.log(`[Seed assets] ${created} uploaded, ${existing} already existed`);
}

run().catch((error: unknown) => {
  console.error('[Seed assets] Failed:', error);
  process.exit(1);
});
