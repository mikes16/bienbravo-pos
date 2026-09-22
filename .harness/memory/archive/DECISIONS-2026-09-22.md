# DECISIONS archivadas — 2026-09-22 (T-048)

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
