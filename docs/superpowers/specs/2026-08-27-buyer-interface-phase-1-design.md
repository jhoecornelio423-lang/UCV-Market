# Fase 1 de mejora de interfaces del comprador

**Fecha:** 2026-08-27

**Estado:** aprobado e implementado

**Alcance:** experiencia del rol comprador

## Objetivo

Corregir primero los problemas funcionales y de usabilidad que afectan la navegación cotidiana del comprador, sin rediseñar todavía la identidad visual ni modificar los flujos de negocio de carrito, compra o pedidos.

La fase debe dejar una base estable para que la segunda etapa pueda concentrarse en unificar tarjetas, aprovechar mejor el espacio en escritorio, agregar esqueletos de carga y pulir el diseño responsive.

## Problemas confirmados

1. Al recargar o abrir directamente una ruta protegida, una sesión válida puede terminar en `/login` por una carrera entre la inicialización de Supabase y el guard.
2. La navegación lateral de escritorio no se conserva de manera consistente en todas las vistas principales del comprador, especialmente en Perfil.
3. Varios controles representados únicamente por iconos no tienen un nombre accesible.
4. Explorar muestra el encabezado de emprendimientos aunque no existan vendedores para mostrar.
5. El estado vacío de Pedidos no orienta al comprador hacia una acción útil y no diferencia claramente pedidos activos de historial.
6. Hay textos visibles o accesibles en inglés, además de plurales incorrectos como `1 items` o `0 items`.

## Diseño propuesto

### 1. Inicialización de sesión determinista

`AuthService` realizará una lectura inicial explícita de la sesión con Supabase y resolverá el perfil asociado antes de declarar que la autenticación terminó de inicializarse. La suscripción a eventos de autenticación seguirá activa para reaccionar a inicios, cierres y renovaciones posteriores.

El guard consumirá ese estado ya resuelto como única fuente de verdad, evitando iniciar una segunda comprobación que compita con la carga inicial. Se conservarán:

- la redirección de usuarios no autenticados a `/login`;
- las restricciones por rol;
- el retorno a la ruta originalmente solicitada cuando corresponda;
- los flujos OAuth y los enlaces profundos de la aplicación móvil.

### 2. Navegación coherente por tamaño de pantalla

En escritorio, la barra lateral global deberá permanecer visible en las rutas principales del comprador:

- Catálogo;
- Explorar;
- Pedidos;
- Favoritos;
- Perfil.

En móvil se mantendrá la navegación inferior en esas mismas vistas. Las pantallas transaccionales o de detalle —producto, carrito, checkout y vistas equivalentes— conservarán su navegación contextual y no recibirán una segunda barra que compita con ella.

Se eliminarán manejadores de navegación duplicados cuando un elemento ya utilice `routerLink`.

### 3. Accesibilidad de controles

Todo botón que solo muestre un icono tendrá un nombre accesible en español mediante `aria-label` y, cuando aporte valor en escritorio, `title`. Esto incluye como mínimo:

- volver, marcar favorito y abrir carrito en detalle de producto;
- aumentar y disminuir cantidad;
- eliminar productos del carrito;
- abrir filtros;
- cambiar la foto de perfil;
- cualquier otro control equivalente encontrado en los componentes incluidos en esta fase.

Los controles táctiles tendrán un objetivo mínimo de 44 × 44 px siempre que pueda lograrse sin alterar de forma significativa la composición visual. Las estadísticas interactivas del perfil se implementarán con semántica de botón o enlace y serán utilizables con teclado.

### 4. Estados vacíos útiles

La sección de emprendimientos de Explorar se renderizará únicamente cuando exista al menos un vendedor disponible.

Pedidos diferenciará sus dos estados vacíos:

- **Activos:** mensaje breve y botón `Explorar productos`, dirigido a `/buyer-panel/explore`.
- **Historial:** mensaje que indique que todavía no hay compras finalizadas, sin prometer información inexistente.

El botón del estado vacío solo navega; no crea ni modifica datos.

### 5. Consistencia del idioma

Todos los textos visibles y nombres accesibles modificados en esta fase estarán en español. Los contadores usarán singular y plural correctos, por ejemplo `1 producto` y `2 productos`.

## Archivos y áreas previstas

- `frontend/src/app/core/auth/auth.service.ts`
- `frontend/src/app/core/auth/auth.guard.ts`
- pruebas unitarias nuevas o ampliadas para autenticación y guards
- `frontend/src/app/app.component.*` para la visibilidad de navegación global
- plantillas, estilos y pruebas de Explorar, Pedidos, Detalle de producto, Carrito y Perfil del comprador

La lista puede ajustarse si las pruebas revelan que una responsabilidad está ubicada en otro componente, pero no se ampliará el alcance funcional sin nueva aprobación.

## Criterios de aceptación

1. Con una sesión persistida válida, recargar `/buyer-panel/catalog` mantiene al usuario en esa ruta después de inicializar la aplicación.
2. Sin sesión válida, una ruta protegida redirige a `/login`.
3. Un usuario autenticado con un rol no autorizado sigue sin poder entrar en rutas de otro rol.
4. A ancho de escritorio, las cinco rutas principales del comprador muestran la barra lateral global; en móvil muestran la navegación inferior correspondiente.
5. Las pantallas de detalle y transacción no muestran navegación global duplicada.
6. Todos los controles de icono incluidos tienen nombres accesibles descriptivos en español y pueden operarse con teclado cuando aplica.
7. Explorar no muestra un encabezado vacío de emprendimientos.
8. Pedidos activos vacío ofrece acceso a Explorar; Historial vacío comunica correctamente que aún no hay compras finalizadas.
9. Los contadores modificados muestran singular y plural correctos y no queda texto de interfaz en inglés dentro del alcance.
10. No cambia el comportamiento de precios, cantidades, checkout, creación de órdenes ni persistencia de datos.

## Verificación

La implementación se hará con pruebas antes de cada corrección relevante e incluirá:

- pruebas del guard para sesión persistida, ausencia de sesión y rol incorrecto;
- pruebas de componentes para nombres accesibles, sección condicional, estados vacíos, navegación y pluralización;
- revisión manual de los flujos principales en 390 px, 768 px y 1280 px;
- ejecución completa de lint, pruebas automatizadas y build de producción.

## Fuera de alcance de esta fase

- unificación visual completa de las tarjetas de productos;
- rediseño de detalle de producto para aprovechar todo el ancho de escritorio;
- esqueletos de carga y sustitución general de placeholders;
- renovación visual amplia o cambio de identidad gráfica;
- interfaces de vendedor o administrador;
- cambios en el modelo de datos o en la lógica de compra.

Estos puntos forman la fase 2 o revisiones posteriores por rol.
