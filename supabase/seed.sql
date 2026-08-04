-- SEMILLA DE CATEGORÍAS PARA UCV MARKET
INSERT INTO public.categories (name, slug, icon)
VALUES 
  ('Comidas y Almuerzos', 'comidas', '🍔'),
  ('Postres y Dulces', 'postres', '🍰'),
  ('Bebidas y Jugos', 'bebidas', '🥤'),
  ('Servicios de Programación y Diseño', 'servicios-tecnologicos', '💻'),
  ('Asesoría Académica y Apuntes', 'asesoria-academica', '📚'),
  ('Ropa y Accesorios', 'ropa-accesorios', '👕'),
  ('Manualidades y Regalos', 'manualidades-regalos', '🎁')
ON CONFLICT (name) DO NOTHING;
