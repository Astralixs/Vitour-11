-- Supabase Migration: ViTour Schema
-- Run this in Supabase SQL Editor

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Panoramas table
CREATE TABLE IF NOT EXISTS panoramas (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  title TEXT,
  image_url TEXT NOT NULL,
  pitch REAL DEFAULT 0,
  yaw REAL DEFAULT 0,
  hfov REAL DEFAULT 100,
  is_first_scene BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotspots table
CREATE TABLE IF NOT EXISTS hotspots (
  id BIGSERIAL PRIMARY KEY,
  panorama_id BIGINT NOT NULL REFERENCES panoramas(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info',
  pitch REAL NOT NULL,
  yaw REAL NOT NULL,
  text TEXT,
  target_panorama_id BIGINT REFERENCES panoramas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_panoramas_location_id ON panoramas(location_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_panorama_id ON hotspots(panorama_id);

-- Storage: Allow anonymous uploads to the panoramas bucket
-- First, create the bucket via Supabase Dashboard: Storage → Create bucket → name "panoramas" → Public
-- Then run this to allow the frontend to upload images:
CREATE POLICY "anon_upload_panoramas"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'panoramas');

CREATE POLICY "anon_select_panoramas"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'panoramas');
