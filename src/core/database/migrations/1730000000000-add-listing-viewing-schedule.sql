ALTER TABLE listings
ADD COLUMN IF NOT EXISTS viewing_schedule JSONB;
