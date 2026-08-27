# Cómo colaborar en VALLE-GO

## Preparación

1. Instala Node 22 y entra en `frontend/`.
2. Ejecuta `npm ci`.
3. Copia `.env.example` a `.env` y configura `SUPABASE_URL` y `SUPABASE_KEY`.
4. Ejecuta `npm start` para desarrollo local.

No uses una `service_role` key en el frontend. La clave de administración y las credenciales de Firebase pertenecen exclusivamente a Supabase Secrets.

## Ramas y commits

- `main` debe permanecer compilable y desplegable.
- Crea ramas cortas: `feature/nombre`, `fix/nombre`, `docs/nombre` o `chore/nombre`.
- Usa commits descriptivos, por ejemplo `feat: add seller availability filter`.
- No incluyas APK, AAB, `build/`, `www/`, credenciales ni archivos de entorno generados.

## Pull requests

- Mantén cada PR enfocado en un solo objetivo.
- Explica el comportamiento anterior y el nuevo.
- Incluye capturas cuando cambie la interfaz.
- Pide revisión al compañero antes de integrar.
- No despliegues una rama de funcionalidad como producción.

Antes de abrir el PR, ejecuta desde `frontend/`:

```bash
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

## Migraciones de Supabase

- `supabase/migrations/` es la única fuente de verdad del esquema.
- Crea una migración nueva por cada cambio; no modifiques una ya aplicada en un entorno compartido.
- Prueba el historial completo localmente antes de ejecutar `supabase db push`.
- Coordina explícitamente quién aplica migraciones y despliega Edge Functions.

## Despliegues

- Cloudflare Pages aloja el frontend web.
- Supabase aloja base de datos, autenticación, almacenamiento y Edge Functions.
- La publicación en Google Play se genera desde un AAB firmado guardado fuera de Git.
