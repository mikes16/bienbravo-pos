# DECISIONS archivadas — 2026-09-22 (T-048, T-051)

## T-048 (2026-09-22)

Curación de `.harness/memory/DECISIONS.md`: consolida 5 grupos de decisiones
que expresaban la misma regla (11 entradas → 5 entradas nuevas: D-059 a
D-063) para bajar el archivo debajo del tope blando. Las 10 entradas
sustituidas se archivan ÍNTEGRAS, sin editar su texto original, para que un
docblock del código que cite su [D-NNN] siga siendo resoluble. Mapeo:
D-029/D-030 → D-059, D-018/D-025 → D-060, D-019/D-049 → D-061, D-040/D-045 →
D-062, D-003/D-004/D-047 → D-063. Ver `.harness/memory/DECISIONS.md` para
las decisiones vigentes.

- [D-029] 2026-09-22 (T-021) Un provider de core/ que puede montarse sin sesión no usa useLiveRefresh directo (lanza sin canal arriba): registra en un sub-componente montado sólo cuando FreshnessContext existe. — SUSTITUIDA por D-059.
- [D-030] 2026-09-22 (T-022) Un hook de core/ que puede montarse sin sesión NO usa useLiveRefresh ([D-029] llevado a hooks): lee FreshnessContext directo y, sin canal arriba, no registra nada. Aplica a todo lo que consuma el shell antes del login. — SUSTITUIDA por D-059.
- [D-018] 2026-09-22 (T-013) Una pantalla de dinero tira su lista al fallar el refresco (estado a null + aviso con Reintentar): nunca se deja lo anterior en pantalla acompañado de un banner. — SUSTITUIDA por D-060.
- [D-025] 2026-09-22 (T-017a) El esqueleto de una pantalla VIVA es sólo para la primera carga (loading && lista vacía): un aviso del canal no vacía a filas-esqueleto una lista ya pintada; y un fallo conserva la lista con aviso 'Sin conexión · datos de las HH:MM' ([D-018] es regla de dinero). — SUSTITUIDA por D-060.
- [D-019] 2026-09-22 (T-014) Una pantalla registra una carga POR CLASE de dato en el canal de frescura, no una sola por pantalla: el tema sales sólo recarga dinero y walkins/appointments sólo la lista. Nadie vuelve a colgar un refetch monolítico del canal. — SUSTITUIDA por D-061.
- [D-049] 2026-09-22 (T-044) El estado de frescura de una pantalla de dinero vive en el HOOK de datos (status + registers: T[] | null), no en cada componente: los tres consumidores de Caja comparten la misma lectura y ninguno decide por su cuenta cuándo es esqueleto. — SUSTITUIDA por D-061.
- [D-040] 2026-09-22 (T-029) Un rechazo del API que llega como GraphQLError con extensions.code conserva código y mensaje en producción (el filtro sólo enmascara Error pelones): clasificar por texto es seguro ahí, al contrario que el caso STOCK. — SUSTITUIDA por D-062.
- [D-045] 2026-09-22 (T-036) Un rechazo del API que el POS sólo reconoce por TEXTO no cuenta como recuperable en producción: se documenta como respaldo de desarrollo y el criterio que lo declara recuperable queda pendiente del código (extensions.code) del API. Complementa [D-040]. — SUSTITUIDA por D-062.
- [D-003] 2026-09-22 (T-005) La persistencia del caché del POS es lista de permitidos: un campo raíz de Query sin clasificar en src/core/apollo/dataClasses.ts NO se persiste. Toda query nueva clasifica su campo raíz ahí; nadie define listas paralelas de campos estáticos. — SUSTITUIDA por D-063.
- [D-004] 2026-09-22 (T-005) barbers y los singulares service/catalogCombo NO se persisten en el caché del dispositivo: PII de staff el primero; precio viejo que el evict por versión de catálogo no alcanza los otros dos. — SUSTITUIDA por D-063.
- [D-047] 2026-09-22 (T-042) Evictar ≠ persistir: CATALOG_EVICTION_FIELDS (dataClasses.ts) dice qué se tira EN MEMORIA al cambiar la versión de catálogo e incluye los singulares service/catalogCombo; PERSISTED_ROOT_FIELDS sigue siendo STATIC ∪ SESSION y [D-004] queda intacta. Quien invalide catálogo usa esa lista, nunca una local. — SUSTITUIDA por D-063.

## T-051 (2026-09-22)

Segunda ronda: consolida 5 grupos más (11 entradas → 5 nuevas: D-066 a
D-070) para volver a bajar `DECISIONS.md`, esta vez por debajo del 70 % del
tope (56 líneas). Mapeo: D-011/D-012 → D-066, D-035/D-046 → D-067,
D-041/D-054 → D-068, D-005/D-006/D-007 → D-069, D-050/D-052 → D-070. Las
11 entradas sustituidas se archivan ÍNTEGRAS a continuación. Candidatos de
la tarea que NO se consolidaron por no ser variantes de la misma regla
(quedan vigentes en DECISIONS.md): D-013 (truncado del texto del
RefreshControl, no de dinero-vs-viva como D-060), D-023 (stub del canal en
renderWithProviders, no la suscripción acotada de D-053), D-049/D-061 (D-049
ya no existía como entrada activa — T-048 la había sustituido).

- [D-011] 2026-09-22 (T-009) Alcance de [D-010]: prohíbe saludos e identidad decorativa repetida, no la atribución operativa. El CTA de cobro y la confirmación de pago sí declaran al operador ('Cobrar … como {PrimerNombre}'); fuera del momento del cobro sigue valiendo D-010 tal cual. — SUSTITUIDA por D-066.
- [D-012] 2026-09-22 (T-009) El nombre del operador en el cobro es el de la SESIÓN (viewer.staff.fullName), nunca el del barbero atribuido a las líneas: quien cambie esto rompe el escenario que motivó R9. — SUSTITUIDA por D-066.
- [D-035] 2026-09-22 (T-026) Un rechazo del API que el POS ya recuperó NO se muestra como error: va en rejectionNotice y mientras exista la hoja de pago no se renderiza (derivado, sin efecto). Cobrar vuelve a exigir un toque en el CTA, que es quien descarta el aviso. — SUSTITUIDA por D-067.
- [D-046] 2026-09-22 (T-039) Ningún rechazo del cobro puede salir de recoverFromRejection sin dejar error o rejectionNotice: el switch es exhaustivo sobre AnyCheckoutRejectionCode y su default asigna a never, así que un código nuevo del dominio no compila hasta decidir si es recuperable (aviso) o no (banner de error). — SUSTITUIDA por D-067.
- [D-041] 2026-09-22 (T-030) Una línea del carrito está en modo staff si y solo si es de producto y trae listUnitPriceCents (precio público congelado al agregarla), espejo de SaleItem.listUnitPriceCents del API: nadie agrega una bandera paralela de 'modo staff' por línea. — SUSTITUIDA por D-068.
- [D-054] 2026-09-22 (T-031) El precio staff comiteado por línea vive en un mapa del hook useCheckout (lineId → { listUnitPriceCents, productVariantId }) porque lib/cart.ts está fuera del alcance: sigue siendo la ÚNICA marca de línea staff ([D-041]), sin bandera paralela, y se colapsa dentro de CartLine cuando esa tarea llegue. — SUSTITUIDA por D-068.
- [D-005] 2026-09-22 (T-006) Dinero del servidor en pantallas nuevas se pinta con MoneyValue, nunca con MoneyDisplay directo: MoneyDisplay queda como formateador interno. — SUSTITUIDA por D-069.
- [D-006] 2026-09-22 (T-006) label es prop obligatoria de MoneyValue (raíz role=group + aria-label): toda cifra de dinero queda anunciada y se consulta en tests con getByRole('group', { name }). — SUSTITUIDA por D-069.
- [D-007] 2026-09-22 (T-006) aria-busy solo se emite en loading y updating (atributo ausente en el resto, nunca "false"), siguiendo la convención ya usada en CatalogListRow/CatalogTile. — SUSTITUIDA por D-069.
- [D-050] 2026-09-22 (T-044) Un hook que re-sincroniza dentro de un catch traga SOLO el fallo del re-sync (await load().catch(() => {})) y re-lanza el error original del servidor: un tropiezo de red no puede suplantar al rechazo que el caller debe mostrar. — SUSTITUIDA por D-070.
- [D-052] 2026-09-22 (T-016d) El splash de un cierre de caja YA confirmado por el servidor gana sobre cualquier estado de la lectura: el re-sync posterior a closeSession puede fallar y no se puede anunciar 'no se pudo confirmar' sobre una caja que sí cerró. — SUSTITUIDA por D-070.
