-- Añadir preferencias del vendedor a la tabla profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_explore BOOLEAN DEFAULT true;
