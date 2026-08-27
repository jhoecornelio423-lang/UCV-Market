# Team-ready Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el repositorio actual en una base reproducible y segura para colaboración mediante pull requests.

**Architecture:** Se conserva el monorepo Ionic/Angular + Capacitor + Supabase. Se eliminan del índice los productos de compilación, se establece una sola ruta de migraciones, se centraliza el arnés de pruebas y se añade CI para validar el frontend.

**Tech Stack:** Angular 20, Ionic 8, Capacitor 8, Supabase CLI, Cloudflare Pages, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-27-team-ready-repository-design.md`

## Global Constraints

- Preservar el cambio local existente en `frontend/.vscode/extensions.json`.
- No reescribir el historial Git ni publicar cambios remotos.
- No borrar del disco los artefactos Android; retirarlos solamente del índice Git.
- Mantener Cloudflare Pages como único hosting web documentado.

---

### Task 1: Higiene del repositorio

**Files:**
- Modify: `.gitignore`
- Create: `.gitattributes`
- Create: `.nvmrc`
- Delete: `package-lock.json`
- Remove from Git index: `frontend/android/app/build/`, `frontend/android/app/release/`, `frontend/src/environments/*.ts`

- [ ] Añadir reglas para productos Android, entornos y archivos locales.
- [ ] Normalizar finales de línea para evitar conflictos Windows/Linux.
- [ ] Fijar Node 22 y retirar el lockfile vacío de la raíz.
- [ ] Confirmar que los artefactos permanecen en disco y quedan ignorados.

### Task 2: Fuente única de base de datos

**Files:**
- Create: `supabase/migrations/20260806000000_create_seller_applications.sql`
- Delete: `supabase_migrations/create_seller_applications.sql`
- Delete: `supabase_migrations/create_support_tickets.sql`

- [ ] Convertir la tabla y sus políticas en una migración idempotente.
- [ ] Retirar la carpeta SQL paralela.
- [ ] Buscar referencias para confirmar que solo quede `supabase/migrations/`.

### Task 3: Configuración reproducible y Cloudflare

**Files:**
- Modify: `frontend/generate-env.js`
- Modify: `frontend/package.json`
- Delete: `netlify.toml`
- Modify: `README.md`
- Modify: `docs/02_architecture_and_uml.md`
- Modify: `docs/04_devops_and_business_strategy.md`

- [ ] Hacer que los comandos generen el entorno y fallen claramente si falta configuración.
- [ ] Documentar Node, `npm ci`, Supabase local y Cloudflare Pages.
- [ ] Eliminar las instrucciones antiguas de Netlify/Vercel.
- [ ] Ejecutar `npm run lint` y `npm run build` con variables controladas.

### Task 4: Flujo de colaboración y CI

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `.github/pull_request_template.md`
- Create: `.github/workflows/ci.yml`

- [ ] Documentar ramas, commits, revisión y migraciones.
- [ ] Añadir checklist de pull request.
- [ ] Configurar Node 22, `npm ci`, lint, tests y build en GitHub Actions.

### Task 5: Arnés compartido de pruebas

**Files:**
- Create: `frontend/src/testing/test-providers.ts`
- Modify: `frontend/src/**/*.spec.ts`

- [ ] Reproducir las pruebas fallidas por dependencias ausentes.
- [ ] Añadir dobles compartidos para servicios y repositorios externos.
- [ ] Proporcionar el router de Angular en todos los smoke tests.
- [ ] Ejecutar la suite completa y confirmar 17 pruebas correctas.

### Task 6: Verificación final

- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm test -- --watch=false --browsers=ChromeHeadless`.
- [ ] Ejecutar `npm run build`.
- [ ] Revisar `git diff --check`, `git status` y los archivos aún versionados.
