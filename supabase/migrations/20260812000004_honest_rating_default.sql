-- ========================================================
-- Rating honesto: sin "5.00" por defecto ni con 0 reseñas
-- ========================================================

-- 1. Permitir rating 0.00 (sin reseñas) en profiles
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_rating_average_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_rating_average_check CHECK (rating_average >= 0.00 AND rating_average <= 5.00);

ALTER TABLE public.profiles
    ALTER COLUMN rating_average SET DEFAULT 0.00;

-- 2. El trigger de nuevo usuario crea el perfil con rating 0.00
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role, campus, rating_average)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Estudiante UCV'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        (COALESCE(NEW.raw_user_meta_data->>'role', 'comprador'))::public.user_role,
        COALESCE(NEW.raw_user_meta_data->>'campus', 'Campus Central'),
        0.00
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recalcular rating: si no hay reseñas, el promedio es 0.00
CREATE OR REPLACE FUNCTION public.recalculate_seller_rating()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    v_avg DECIMAL(3, 2);
    v_seller_id UUID;
BEGIN
    -- Identificamos quién es el vendedor calificado
    IF TG_OP = 'INSERT' THEN
        v_seller_id := NEW.reviewee_id;
    ELSE
        v_seller_id := OLD.reviewee_id;
    END IF;

    -- Calcular promedio
    SELECT COALESCE(AVG(rating), 0.00) INTO v_avg
    FROM public.reviews
    WHERE reviewee_id = v_seller_id;

    -- Actualizar perfil
    UPDATE public.profiles
    SET rating_average = v_avg,
        updated_at = NOW()
    WHERE id = v_seller_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Recalcular los ratings existentes con los datos reales de reseñas
UPDATE public.profiles SET rating_average = 0.00;

UPDATE public.profiles p
SET rating_average = COALESCE(
    (SELECT AVG(r.rating) FROM public.reviews r WHERE r.reviewee_id = p.id),
    0.00
);
