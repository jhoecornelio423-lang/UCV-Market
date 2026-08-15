-- ============================================================
-- Notificar al vendedor cuando el COMPRADOR cancela un pedido
-- 1) Columna cancelled_by en orders: registra quién canceló
-- 2) Trigger BEFORE UPDATE: asigna auth.uid() automáticamente
-- El webhook y el realtime ya incluyen NEW completo (REPLICA IDENTITY FULL),
-- por lo que la Edge Function send-push puede decidir a quién notificar.
-- ============================================================

-- 1) Columna cancelled_by
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id);

-- 2) Función + trigger que captura al actor de la cancelación
CREATE OR REPLACE FUNCTION public.set_order_cancelled_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.cancelled_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancelled_by ON public.orders;
CREATE TRIGGER trg_order_cancelled_by
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled')
  EXECUTE FUNCTION public.set_order_cancelled_by();
