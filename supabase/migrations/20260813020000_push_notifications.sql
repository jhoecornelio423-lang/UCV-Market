-- ============================================================
-- Push notifications (FCM)
-- Tabla de tokens + triggers que disparan la Edge Function send-push
-- ============================================================

-- Habilitar la extensión pg_net para peticiones HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;


-- 1) Tabla de tokens por usuario
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gestionan sus tokens push" ON public.push_tokens;
CREATE POLICY "Usuarios gestionan sus tokens push"
ON public.push_tokens FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) Triggers webhook -> Edge Function send-push
--    La función envía la notificación FCM al usuario implicado.
--    WEBHOOK_URL y WEBHOOK_SECRET deben coincidir con los secrets de la función.

DO $$
DECLARE
  WEBHOOK_URL constant text := 'https://dqjuifzsowwrrfppczsj.functions.supabase.co/send-push';
  WEBHOOK_SECRET constant text := '94c1ef6a78d3b250';
BEGIN
  -- Pedido nuevo -> vendedor
  DROP TRIGGER IF EXISTS trg_order_created_push ON public.orders;
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.trg_order_created_push_fn()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $body$
    BEGIN
      PERFORM net.http_post(
        '%s',
        jsonb_build_object(
          'type', 'INSERT',
          'table', 'orders',
          'record', to_jsonb(NEW)
        ),
        jsonb_build_object('Content-Type', 'application/json', 'Authorization', '%s'),
        '5000'
      );
      RETURN NEW;
    END $body$;
  $fn$, WEBHOOK_URL, WEBHOOK_SECRET);
  CREATE TRIGGER trg_order_created_push
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_created_push_fn();

  -- Cambio de estado del pedido -> comprador
  DROP TRIGGER IF EXISTS trg_order_status_push ON public.orders;
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.trg_order_status_push_fn()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $body$
    BEGIN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM net.http_post(
          '%s',
          jsonb_build_object(
            'type', 'UPDATE',
            'table', 'orders',
            'record', to_jsonb(NEW),
            'old', to_jsonb(OLD)
          ),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', '%s'),
          '5000'
        );
      END IF;
      RETURN NEW;
    END $body$;
  $fn$, WEBHOOK_URL, WEBHOOK_SECRET);
  CREATE TRIGGER trg_order_status_push
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_status_push_fn();

  -- Cambio de estado del reporte -> reporter
  DROP TRIGGER IF EXISTS trg_report_status_push ON public.product_reports;
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.trg_report_status_push_fn()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $body$
    BEGIN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM net.http_post(
          '%s',
          jsonb_build_object(
            'type', 'UPDATE',
            'table', 'product_reports',
            'record', to_jsonb(NEW),
            'old', to_jsonb(OLD)
          ),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', '%s'),
          '5000'
        );
      END IF;
      RETURN NEW;
    END $body$;
  $fn$, WEBHOOK_URL, WEBHOOK_SECRET);
  CREATE TRIGGER trg_report_status_push
  AFTER UPDATE OF status ON public.product_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_report_status_push_fn();
END $$;
