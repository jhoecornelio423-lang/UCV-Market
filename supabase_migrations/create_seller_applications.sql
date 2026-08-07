-- 1. Create seller_applications table
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
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_seller_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seller_applications_updated_at_trigger
BEFORE UPDATE ON public.seller_applications
FOR EACH ROW
EXECUTE FUNCTION update_seller_applications_updated_at();

-- 3. Row Level Security (RLS)
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own applications
CREATE POLICY "Users can insert their own seller applications"
ON public.seller_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own applications
CREATE POLICY "Users can view their own seller applications"
ON public.seller_applications FOR SELECT
USING (auth.uid() = user_id);

-- Allow anyone to read approved applications to check uniqueness of business_name
CREATE POLICY "Anyone can view approved business names"
ON public.seller_applications FOR SELECT
USING (status = 'approved');

-- Allow admins to do anything (Assuming 'admin' role in profiles table)
CREATE POLICY "Admins can manage all seller applications"
ON public.seller_applications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
