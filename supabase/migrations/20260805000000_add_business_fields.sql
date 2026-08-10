-- 1. AGREGAR COLUMNAS DE NEGOCIO A LA TABLA profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_description TEXT,
ADD COLUMN IF NOT EXISTS business_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS business_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS open_time VARCHAR(5) DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS close_time VARCHAR(5) DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512),
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

-- 2. CREAR EL BUCKET PÚBLICO PARA LOS ASSETS DEL NEGOCIO (SI NO EXISTE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 3. POLÍTICAS DE ACCESO PARA EL BUCKET business-assets
-- Lectura pública para cualquier usuario (para mostrar banners y avatares)
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'business-assets');

-- Inserción y actualización para usuarios autenticados
CREATE POLICY "Authenticated User Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'business-assets' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated User Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'business-assets'
    AND auth.role() = 'authenticated'
  );

-- Eliminación permitida para usuarios autenticados
CREATE POLICY "Authenticated User Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'business-assets'
    AND auth.role() = 'authenticated'
  );
