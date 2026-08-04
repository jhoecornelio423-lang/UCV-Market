-- Agrega el código de estudiante sin afectar los perfiles existentes.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS student_code VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_code_unique
ON public.profiles(student_code)
WHERE student_code IS NOT NULL;

-- Incluye el código enviado en los metadatos de Auth al crear perfiles nuevos.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        phone,
        student_code,
        role,
        campus,
        rating_average
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Estudiante UCV'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        NULLIF(NEW.raw_user_meta_data->>'student_code', ''),
        (COALESCE(NEW.raw_user_meta_data->>'role', 'comprador'))::public.user_role,
        COALESCE(NEW.raw_user_meta_data->>'campus', 'UCV - Lima Norte'),
        5.00
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
