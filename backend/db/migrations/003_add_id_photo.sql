-- Add ID photo URL to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS id_photo_url TEXT;

-- Create storage buckets (run in Supabase dashboard if this fails via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('id-photos', 'id-photos', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true) ON CONFLICT DO NOTHING;
