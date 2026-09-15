-- Migration: 1726400000000-convert-amenities-to-numeric.sql
-- Mô tả: Chuyển đổi định danh tiện ích (amenities) và nhóm tiện ích (group) sang kiểu số (SMALLINT)

DO $$
BEGIN
  -- 1. Nếu bảng amenities đang dùng uuid cho khóa chính id, tiến hành chuyển đổi sang SMALLINT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'amenities' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    DROP TABLE IF EXISTS listing_amenities CASCADE;
    DROP TABLE IF EXISTS amenities CASCADE;

    CREATE TABLE amenities (
      id SMALLINT PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      "group" SMALLINT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE listing_amenities (
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      amenity_id SMALLINT NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (listing_id, amenity_id)
    );
  END IF;
END $$;

