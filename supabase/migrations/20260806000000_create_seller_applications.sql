-- Solicitudes para convertir una cuenta compradora en emprendimiento.
-- Esta migración es idempotente para adoptar instalaciones donde la tabla
-- pudo haberse creado anteriormente mediante un script manual.

CREATE TABLE IF NOT EXISTS public.seller_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dni VARCHAR(8) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL UNIQUE,
  business_category VARCHAR(100) NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  logo_url TEXT,
  description TEXT,
  phone VARCHAR(20) NOT NULL,
  delivery_points TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.update_seller_applications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_seller_applications_updated_at_trigger
  ON public.seller_applications;
CREATE TRIGGER update_seller_applications_updated_at_trigger
  BEFORE UPDATE ON public.seller_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seller_applications_updated_at();

ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own seller applications"
  ON public.seller_applications;
CREATE POLICY "Users can insert their own seller applications"
  ON public.seller_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own seller applications"
  ON public.seller_applications;
CREATE POLICY "Users can view their own seller applications"
  ON public.seller_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view approved business names"
  ON public.seller_applications;
CREATE POLICY "Anyone can view approved business names"
  ON public.seller_applications FOR SELECT TO authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Admins can manage all seller applications"
  ON public.seller_applications;
CREATE POLICY "Admins can manage all seller applications"
  ON public.seller_applications FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );
