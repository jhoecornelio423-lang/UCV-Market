-- 1. EXTENSIONES RECOMENDADAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS DE BASE DE DATOS
CREATE TYPE public.user_role AS ENUM ('comprador', 'emprendedor', 'admin');
CREATE TYPE public.order_status AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled');
CREATE TYPE public.stock_log_type AS ENUM ('sale', 'restock', 'adjustment');

-- 3. TABLA: profiles (Vinculada a auth.users de Supabase)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role public.user_role NOT NULL DEFAULT 'comprador',
    rating_average DECIMAL(3, 2) NOT NULL DEFAULT 5.00 CHECK (rating_average >= 1.00 AND rating_average <= 5.00),
    campus VARCHAR(100) NOT NULL DEFAULT 'Campus Central',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. TABLA: categories
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 5. TABLA: products
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0.00),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pickup_location VARCHAR(255) NOT NULL,
    whatsapp_clicks INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp_clicks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Índices para búsquedas y filtros
CREATE INDEX idx_products_category_active ON public.products(category_id, is_active);
CREATE INDEX idx_products_seller ON public.products(seller_id);

-- 6. TABLA: product_images
CREATE TABLE public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url VARCHAR(512) NOT NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en product_images
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- 7. TABLA: favorites
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Habilitar RLS en favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 8. TABLA: orders
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0.00),
    delivery_place VARCHAR(255) NOT NULL,
    status public.order_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);

-- 9. TABLA: order_items
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_sale DECIMAL(10, 2) NOT NULL CHECK (price_at_sale >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 10. TABLA: reviews
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 11. TABLA: stock_logs
CREATE TABLE public.stock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_changed INTEGER NOT NULL,
    type public.stock_log_type NOT NULL,
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en stock_logs
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;


-- ========================================================
-- DISPARADORES Y FUNCIONES DE AUTOMATIZACIÓN (TRIGGERS)
-- ========================================================

-- Trigger 1: Crear perfil de usuario automáticamente al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- Ejecuta con privilegios elevados para poder insertar en public.profiles
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role, campus, rating_average)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Estudiante UCV'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        (COALESCE(NEW.raw_user_meta_data->>'role', 'comprador'))::public.user_role,
        COALESCE(NEW.raw_user_meta_data->>'campus', 'Campus Central'),
        5.00
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Recalcular la reputación promedio del vendedor al recibir una reseña
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
    SELECT COALESCE(AVG(rating), 5.00) INTO v_avg
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

CREATE TRIGGER on_review_changed
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.recalculate_seller_rating();
