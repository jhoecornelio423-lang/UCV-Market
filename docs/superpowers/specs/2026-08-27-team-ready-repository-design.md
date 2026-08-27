# Team-ready repository design

## Objetivo

Preparar VALLE-GO para que dos desarrolladores trabajen en paralelo sin versionar artefactos generados, sin fuentes de verdad duplicadas y con validaciones automáticas antes de integrar cambios en `main`.

## Estructura acordada

- `frontend/` contiene Ionic/Angular, Capacitor y las fuentes nativas de Android.
- `supabase/migrations/` es la única fuente de verdad para el esquema PostgreSQL.
- `supabase/functions/` contiene las Edge Functions.
- `docs/` contiene arquitectura, operación y acuerdos de colaboración.
- `.github/` contiene la validación automática y la plantilla de pull request.

Los directorios de compilación de Android, APK/AAB, `www/`, credenciales locales y entornos generados no forman parte del control de versiones.

## Flujo de colaboración

`main` representa un estado desplegable. Cada cambio se desarrolla en una rama corta (`feature/*`, `fix/*`, `chore/*`) y entra mediante pull request revisado por el compañero. El pipeline ejecuta instalación reproducible, lint, pruebas y build web.

## Configuración y despliegue

Cloudflare Pages es el único hosting web documentado. `SUPABASE_URL` y `SUPABASE_KEY` se suministran mediante `frontend/.env` en local y secretos/variables del proveedor en despliegue. Los archivos Angular de entorno se generan y no se versionan.

## Base de datos

Toda modificación se añade como una migración nueva e inmutable en `supabase/migrations/`. La solicitud de vendedor se incorpora como migración idempotente para poder adoptarla en entornos donde la tabla fue creada manualmente. El SQL suelto de soporte se retira porque su evolución ya está representada en las migraciones numeradas.

## Pruebas

Los smoke tests de componentes usarán un arnés compartido con rutas y dobles de las fronteras externas. Esto impide conexiones a Supabase durante las pruebas y mantiene en un solo sitio la configuración de inyección requerida por los componentes.

## Fuera de alcance

- Reescribir el historial Git para eliminar los objetos grandes antiguos.
- Automatizar la firma o publicación en Google Play.
- Cambiar la arquitectura funcional o el diseño visual de la aplicación.
- Refactorizar componentes grandes que no estén relacionados con el saneamiento.
