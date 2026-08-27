# Buyer Interface Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la restauración de sesión, la navegación responsive, la accesibilidad y los estados vacíos principales del rol comprador.

**Architecture:** `AuthService` resolverá sesión y perfil antes de publicar que terminó su inicialización; `AuthGuard` decidirá únicamente con ese estado estable. La navegación global se determinará por rol y por una lista explícita de rutas principales, mientras que las mejoras de interfaz permanecerán dentro de cada componente comprador.

**Tech Stack:** Angular 20, Ionic 8, RxJS 7, Supabase JS 2, Jasmine/Karma, SCSS.

**Spec:** `docs/superpowers/specs/2026-08-27-buyer-interface-phase-1-design.md`

## Global Constraints

- Mantener las restricciones actuales por rol, OAuth y enlaces profundos nativos.
- No modificar precios, cantidades, checkout, creación de órdenes ni persistencia de datos.
- Todo texto o nombre accesible nuevo debe estar en español.
- Los controles táctiles de icono deben medir al menos 44 × 44 px cuando no altere la composición.
- No incluir el rediseño amplio reservado para la fase 2.
- Trabajar sobre el árbol actual autorizado por el usuario y no crear commits que mezclen cambios estructurales preexistentes.

---

### Task 1: Restauración determinista de sesión y autorización

**Files:**
- Create: `frontend/src/app/core/auth/auth.service.spec.ts`
- Create: `frontend/src/app/core/auth/auth.guard.spec.ts`
- Modify: `frontend/src/app/core/auth/auth.service.ts`
- Modify: `frontend/src/app/core/auth/auth.guard.ts`

**Interfaces:**
- Produces: `AuthService.isInitialized$: Observable<boolean>` que emite `true` solo después de resolver sesión y perfil iniciales.
- Produces: `AuthService.currentProfileValue: Profile | null` como estado estable consumido por `AuthGuard`.
- Removes guard dependency on `hasActiveSession()`; the method may be removed if no other consumer remains.

- [ ] **Step 1: Write failing AuthService bootstrap tests**

Crear dobles específicos para `client.auth.getSession()` y `client.auth.onAuthStateChange()`. Cubrir estos resultados observables:

```ts
it('keeps initialization pending until the persisted profile is loaded', async () => {
  expect(latestInitialized).toBeFalse();
  session.resolve({ data: { session: persistedSession }, error: null });
  expect(latestInitialized).toBeFalse();
  profile.next(buyerProfile);
  expect(service.currentProfileValue).toEqual(buyerProfile);
  expect(latestInitialized).toBeTrue();
});

it('finishes initialization without a profile when no session exists', async () => {
  session.resolve({ data: { session: null }, error: null });
  expect(service.currentProfileValue).toBeNull();
  expect(latestInitialized).toBeTrue();
});
```

- [ ] **Step 2: Run the AuthService tests and confirm RED**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/auth/auth.service.spec.ts`

Expected: the persisted-session test fails because initialization currently depends on the auth callback rather than the explicit session result.

- [ ] **Step 3: Implement deterministic bootstrap**

Register the ongoing auth listener, ignore its unresolved initial null event, call `getSession()` explicitly, and route both the bootstrap and later auth events through one private session handler. That handler must load the profile before setting `isInitializedSubject` to `true`; a missing or failed session must clear profile and finish initialization. Preserve the bounded OAuth fallback and the realtime profile subscription.

- [ ] **Step 4: Run AuthService tests and confirm GREEN**

Run the command from Step 2. Expected: all new bootstrap tests pass.

- [ ] **Step 5: Write failing AuthGuard behavior tests**

Use a real `AuthGuard` with an `AuthService` stub containing `BehaviorSubject`s and assert returned values, not calls to the stub:

```ts
it('keeps an authorized buyer on a protected route after initialization', done => {
  initialized.next(true);
  profile.next(buyerProfile);
  guard.canActivate(buyerRoute, requestedState).subscribe(result => {
    expect(result).toBeTrue();
    done();
  });
});

it('redirects a visitor without a profile to login', done => {
  initialized.next(true);
  profile.next(null);
  guard.canActivate(buyerRoute, requestedState).subscribe(result => {
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    done();
  });
});
```

Add a third case where an `emprendedor` requests a comprador route and receives the existing safe redirect.

- [ ] **Step 6: Run AuthGuard tests and confirm RED**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/auth/auth.guard.spec.ts`

Expected: tests fail because the guard still invokes the removed/racy `hasActiveSession()` path.

- [ ] **Step 7: Simplify AuthGuard to consume initialized profile state**

After the first `true` from `isInitialized$`, read `currentProfileValue`: return `/login` when it is null or suspended, enforce `expectedRoles`, and otherwise return `true`. Keep a bounded timeout that fails closed to `/login`.

- [ ] **Step 8: Run both auth specs and confirm GREEN**

Run both `--include` arguments in one Karma execution. Expected: persisted session, visitor, suspended and wrong-role cases pass.

### Task 2: Navegación global coherente

**Files:**
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/app.component.spec.ts`
- Modify: `frontend/src/app/features/buyer-panel/buyer-panel.component.html`
- Modify: `frontend/src/app/features/buyer-panel/buyer-panel.component.spec.ts`

**Interfaces:**
- Produces: `AppComponent.showSidebar` true for exact buyer top-level routes and false for buyer detail/transaction routes.
- Consumes: `AuthService.currentProfile$` and Angular `NavigationEnd` events.

- [ ] **Step 1: Write failing sidebar route tests**

Exercise the real `AppComponent` with comprador profile and navigation events. Use a table for `/buyer-panel/catalog`, `/explore`, `/orders`, `/favorites`, and `/profile` expecting `showSidebar === true`; use `/product/123`, `/cart`, and `/checkout` expecting `false`. Include a seller route to prove its current sidebar behavior remains intact.

- [ ] **Step 2: Run AppComponent tests and confirm RED**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/app.component.spec.ts`

Expected: detail and transaction cases fail because the current logic shows the sidebar on every authenticated non-admin route.

- [ ] **Step 3: Implement explicit buyer primary-route matching**

Add a focused route predicate that removes query strings and trailing slashes before comparing the five allowed paths. Preserve seller and admin behavior outside the buyer branch.

- [ ] **Step 4: Remove duplicate mobile navigation handlers**

In `buyer-panel.component.html`, keep `routerLink` and remove the five redundant `(click)="goTo(...)"` bindings. Do not alter active-state classes or hidden-route behavior.

- [ ] **Step 5: Add and run a buyer-panel navigation test**

Assert the five bottom-navigation buttons expose exactly one navigation mechanism through their `routerLink` directives. Run the buyer-panel spec and AppComponent spec; expected: GREEN.

### Task 3: Estados vacíos y lenguaje

**Files:**
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-explore/buyer-explore.component.html`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-explore/buyer-explore.component.spec.ts`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-orders/buyer-orders.component.html`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-orders/buyer-orders.component.scss`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-orders/buyer-orders.component.spec.ts`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-cart/buyer-cart.component.html`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-cart/buyer-cart.component.spec.ts`

**Interfaces:**
- Consumes: `BuyerExploreComponent.sellers`, `BuyerOrdersComponent.buyerFilter`, `BuyerOrdersComponent.visibleOrders`, `BuyerCartComponent.cartCount`.
- Produces: active-orders CTA `routerLink="/buyer-panel/explore"` with no data mutation.

- [ ] **Step 1: Write failing component rendering tests**

Assert that Explorar omits the complete seller section when `sellers` is empty and renders it when populated. Assert that Pedidos active empty shows `Explorar productos`, history empty shows `Aún no tienes compras finalizadas`, and only the active state contains the explore link. Assert cart counter renders `1 producto` and `2 productos`.

- [ ] **Step 2: Run the three specs and confirm RED**

Run Karma with the three component spec paths. Expected: all desired conditional/copy assertions fail against current templates.

- [ ] **Step 3: Implement conditional sections and copy**

Wrap seller title and list in one `*ngIf="sellers.length > 0"` container. Split the orders empty template by `buyerFilter`; add the navigation-only CTA to the active state. Replace `items` with an Angular singular/plural expression using `cartCount === 1`.

- [ ] **Step 4: Style the orders CTA with existing design tokens**

Extend only the existing `.empty-state` block so the CTA is keyboard-visible and visually consistent with other primary buyer actions.

- [ ] **Step 5: Run the three specs and confirm GREEN**

Expected: conditional rendering, CTA target and pluralization tests pass.

### Task 4: Accesibilidad de controles interactivos

**Files:**
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-product-detail/buyer-product-detail.component.html`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-product-detail/buyer-product-detail.component.scss`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-product-detail/buyer-product-detail.component.spec.ts`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-cart/buyer-cart.component.html`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-cart/buyer-cart.component.scss`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-profile/buyer-profile.component.html`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-profile/buyer-profile.component.scss`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-profile/buyer-profile.component.spec.ts`
- Modify: `frontend/src/app/features/buyer-panel/components/buyer-explore/buyer-explore.component.html`

**Interfaces:**
- Produces: Spanish accessible names for every icon-only control in the touched views.
- Produces: native buttons/links for profile actions, retaining existing component methods and routes.

- [ ] **Step 1: Write failing accessibility tests**

Set a concrete product/cart/profile fixture, render each component, and query real DOM buttons. Assert names such as `Volver al catálogo`, `Agregar a favoritos`/`Quitar de favoritos`, `Abrir carrito`, `Disminuir cantidad`, `Aumentar cantidad`, `Eliminar <producto> del carrito`, `Abrir filtros`, and `Cambiar foto de perfil`. Assert profile Pedidos/Favoritos are native interactive elements and reachable through their existing destinations.

- [ ] **Step 2: Run accessibility specs and confirm RED**

Run the four affected specs. Expected: controls exist but lack the required names or native semantics.

- [ ] **Step 3: Add accessible names and semantic elements**

Add dynamic `aria-label` values where state changes the action, static Spanish labels elsewhere, informative image `alt` values, and `type="button"` on non-submit buttons. Replace clickable profile statistic `div`s with `button`/`a` elements while retaining CSS classes and behavior.

- [ ] **Step 4: Enforce minimum touch targets**

Update only the relevant icon-control selectors to `min-width: 44px; min-height: 44px`. Preserve current spacing and responsive breakpoints.

- [ ] **Step 5: Run accessibility specs and confirm GREEN**

Expected: all controls have observable accessible names and native keyboard semantics.

### Task 5: Regression and responsive verification

**Files:**
- Modify only if a verification failure identifies an in-scope regression.

**Interfaces:**
- Consumes all deliverables from Tasks 1–4.

- [ ] **Step 1: Run static and automated checks**

From `frontend` run:

```powershell
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Expected: lint exits 0, all tests pass, production build exits 0. Existing Sass deprecation warnings may remain but no new warnings should be introduced.

- [ ] **Step 2: Smoke-test protected routes and role boundaries**

With the authorized comprador session, reload `/buyer-panel/catalog` and confirm the URL remains there. Confirm internal navigation across the five main screens. Verify direct access to seller/admin routes is still rejected for the comprador role without changing data.

- [ ] **Step 3: Inspect responsive UI at 390, 768 and 1280 px**

At each width verify the appropriate navigation, absence of duplicate bars, empty states, Spanish labels and keyboard/touch affordances. Exercise product detail and cart without submitting checkout.

- [ ] **Step 4: Review the final diff**

Run `git diff --check` and inspect only the files listed in this plan. Confirm no secrets, generated files, checkout logic or unrelated user changes entered the diff.
