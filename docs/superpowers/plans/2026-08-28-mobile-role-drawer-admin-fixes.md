# Mobile Role Drawer and Admin Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sustituir la navegación inferior móvil/tablet de comprador, vendedor y administrador por un encabezado y menú lateral compartidos, y corregir los defectos administrativos verificados.

**Architecture:** Un componente presentacional compartido recibirá una configuración tipada por rol y emitirá la solicitud de cierre de sesión. Cada shell conservará la decisión de visibilidad por lista exacta de rutas, las insignias y el comportamiento de notificaciones. El escritorio conservará su navegación actual y las pantallas contextuales no mostrarán navegación global.

**Tech Stack:** Angular 20, Ionic 8, RxJS 7, Jasmine/Karma, SCSS.

**Spec:** `docs/superpowers/specs/2026-08-28-mobile-role-drawer-admin-fixes-design.md`

## Global Constraints

- No modificar esquema, repositorios, permisos, guards ni lógica de negocio de Supabase.
- Usar el corte Ionic `lg`: móvil/tablet `< 992px`, escritorio `>= 992px`.
- Mostrar navegación global únicamente en rutas principales exactas.
- Mantener nombres accesibles en español y objetivos táctiles mínimos de 44 × 44 px.
- No ejecutar acciones administrativas destructivas durante la verificación visual.

### Task 1: Contratos de rutas y configuración compartida

**Files:**
- Create: `frontend/src/app/core/navigation/admin-navigation.ts`
- Create: `frontend/src/app/core/navigation/admin-navigation.spec.ts`
- Create: `frontend/src/app/shared/components/role-mobile-navigation/role-mobile-navigation.model.ts`

- [ ] Escribir pruebas que acepten las siete rutas administrativas principales con query/hash/barra final y rechacen rutas hijas o ajenas.
- [ ] Ejecutar el spec y confirmar RED.
- [ ] Implementar `ADMIN_PRIMARY_ROUTES` e `isAdminPrimaryRoute` reutilizando `normalizeAppPath`.
- [ ] Definir los tipos de identidad, destino, insignia y configuración del menú compartido.
- [ ] Ejecutar el spec y confirmar GREEN.

### Task 2: Componente compartido de encabezado y drawer

**Files:**
- Create: `frontend/src/app/shared/components/role-mobile-navigation/role-mobile-navigation.component.ts`
- Create: `frontend/src/app/shared/components/role-mobile-navigation/role-mobile-navigation.component.html`
- Create: `frontend/src/app/shared/components/role-mobile-navigation/role-mobile-navigation.component.scss`
- Create: `frontend/src/app/shared/components/role-mobile-navigation/role-mobile-navigation.component.spec.ts`
- Modify: módulos de comprador, vendedor y administrador para declarar/importar el componente según la estructura real.

- [ ] Escribir pruebas de render, ruta activa exacta, insignias, evento de cierre de sesión y nombres accesibles.
- [ ] Ejecutar el spec y confirmar RED.
- [ ] Implementar encabezado común, `ion-menu` izquierdo, enlaces semánticos, cierre al navegar, backdrop/Escape y pie con cerrar sesión.
- [ ] Asegurar `aria-current`, `aria-label`, estado expandido y retorno de foco al botón hamburguesa.
- [ ] Aplicar estilos responsive `ion-hide-lg-up`, safe areas y objetivos táctiles de 44 × 44 px.
- [ ] Ejecutar el spec y confirmar GREEN.

### Task 3: Integración en comprador, vendedor y administrador

**Files:**
- Modify: `frontend/src/app/features/buyer-panel/buyer-panel.component.{ts,html,scss,spec.ts}`
- Modify: `frontend/src/app/features/seller-panel/seller-panel.component.{ts,html,scss,spec.ts}`
- Modify: `frontend/src/app/features/admin-panel/admin-panel.component.{ts,html,scss}`
- Create: `frontend/src/app/features/admin-panel/admin-panel.component.spec.ts`

- [ ] Escribir pruebas de shell: menú visible solo en rutas principales, destinos correctos, insignias y logout delegado.
- [ ] Ejecutar los specs y confirmar RED.
- [ ] Reemplazar las tres barras inferiores por el componente compartido y eliminar su CSS obsoleto.
- [ ] Mantener sidebars de escritorio y cambiar el administrador de `md` a `lg` para eliminar la colisión de 768 px.
- [ ] Conectar notificaciones e insignias existentes sin duplicar controles.
- [ ] Ejecutar los specs y confirmar GREEN.

### Task 4: Soporte administrativo operativo y accesible

**Files:**
- Modify: `frontend/src/app/features/admin-panel/components/admin-support/admin-support.component.{ts,html,scss}`
- Modify/Create: `frontend/src/app/features/admin-panel/components/admin-support/admin-support.component.spec.ts`

- [ ] Escribir pruebas que exijan tickets nativamente interactivos y bloqueo de acciones/transiciones para estados terminales.
- [ ] Escribir prueba estructural de desplazamiento móvil y barra de acciones alcanzable.
- [ ] Ejecutar el spec y confirmar RED.
- [ ] Convertir tarjetas seleccionables en botones semánticos y exponer selección con `aria-pressed` o `aria-current`.
- [ ] Centralizar `isTerminalTicket` y deshabilitar prioridad, estado, vinculación, desestimación, advertencia y baneo.
- [ ] Corregir alturas/overflow para que todo el panel y la barra de acciones sean alcanzables en móvil.
- [ ] Ejecutar el spec y confirmar GREEN.

### Task 5: Usuarios, vendedores, productos, notificaciones y reportes

**Files:**
- Modify: `frontend/src/app/features/admin-panel/components/admin-users/admin-users.component.{html,scss}`
- Modify: `frontend/src/app/features/admin-panel/components/admin-sellers/admin-sellers.component.{html,scss}`
- Modify: `frontend/src/app/features/admin-panel/components/admin-products/admin-products.component.{html,scss}`
- Modify: `frontend/src/app/features/admin-panel/components/admin-notifications/admin-notifications.component.{html,scss}`
- Modify: `frontend/src/app/features/admin-panel/components/admin-dashboard/admin-dashboard.component.{ts,html}`
- Modify/Create corresponding `*.spec.ts` files.

- [ ] Escribir pruebas de tarjetas móviles para usuarios/vendedores y tablas desde tablet/escritorio.
- [ ] Escribir pruebas para `h1`, singular/plural español, alt localizado, ausencia de “marcar leídas” sin notificaciones y controles semánticos.
- [ ] Escribir pruebas de resumen textual y etiquetas accesibles de las gráficas.
- [ ] Ejecutar specs y confirmar RED.
- [ ] Implementar tarjetas móviles, conservar tablas desde `md`, corregir copias/semántica y elevar controles de icono a 44 px.
- [ ] Añadir descripción accesible y resumen de datos para cada canvas sin alterar los cálculos.
- [ ] Ejecutar specs y confirmar GREEN.

### Task 6: Regresión y verificación responsive

**Files:**
- Modify únicamente si una verificación descubre una regresión dentro del alcance.

- [ ] Ejecutar `npm run lint` desde `frontend`.
- [ ] Ejecutar `npm test -- --watch=false --browsers=ChromeHeadless` desde la raíz.
- [ ] Ejecutar `npm run build` desde `frontend`.
- [ ] Verificar comprador, vendedor y administrador a 390 × 844, 768 × 1024 y 1280 × 720.
- [ ] Confirmar drawer izquierdo, cierre, ruta activa, ausencia en subpantallas, sidebar de escritorio y límites de rol.
- [ ] Confirmar soporte desplazable y acciones terminales bloqueadas sin modificar datos.
- [ ] Ejecutar `git diff --check`, inspeccionar el diff y confirmar ausencia de secretos, generados y cambios ajenos.
