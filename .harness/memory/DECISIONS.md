# DECISIONS — decisiones vigentes

<!-- ≤80 líneas. Append-only, SOLO vía `harness.mjs add-decision`.
     Formato de entrada: "[D-NNN] fecha-iso (T-NNN) texto".
     Sustitución: la vieja se reescribe como "[D-OLD] SUSTITUIDA por D-NNN".
     Precedencia en los agentes: DECISIONS > PROFILE > criterio propio. -->
- [D-001] 2026-09-22 (T-004) Las ventanas de staffWorkingWindows se consumen en el orden que las devuelve el API (ya ordenadas por startMin, mismo motor que payroll); el POS no reordena ni fusiona.
- [D-002] 2026-09-22 (T-004) src/test/mocks/repositories.ts desactiva @typescript-eslint/no-unused-vars a nivel archivo para cumplir el lint sobre el baseline de errores pre-existentes que ci.yml documenta; el arreglo de fondo (argsIgnorePattern '^_' en eslint.config.js) queda pendiente como chore.
- [D-003] 2026-09-22 (T-005) La persistencia del caché del POS es lista de permitidos: un campo raíz de Query sin clasificar en src/core/apollo/dataClasses.ts NO se persiste. Toda query nueva clasifica su campo raíz ahí; nadie define listas paralelas de campos estáticos.
- [D-004] 2026-09-22 (T-005) barbers y los singulares service/catalogCombo NO se persisten en el caché del dispositivo: PII de staff el primero; precio viejo que el evict por versión de catálogo no alcanza los otros dos.
- [D-005] 2026-09-22 (T-006) Dinero del servidor en pantallas nuevas se pinta con MoneyValue, nunca con MoneyDisplay directo: MoneyDisplay queda como formateador interno.
- [D-006] 2026-09-22 (T-006) label es prop obligatoria de MoneyValue (raíz role=group + aria-label): toda cifra de dinero queda anunciada y se consulta en tests con getByRole('group', { name }).
- [D-007] 2026-09-22 (T-006) aria-busy solo se emite en loading y updating (atributo ausente en el resto, nunca "false"), siguiendo la convención ya usada en CatalogListRow/CatalogTile.
- [D-008] 2026-09-22 (T-007) Los eventos de subscription se piden con fetchPolicy 'no-cache': son pings de invalidación, no datos; no deben entrar al cache ni a lo que se evalúa para persistir [D-003].
- [D-009] 2026-09-22 (T-007) La primera conexión del socket NO dispara refresco; sólo las reconexiones, una vez y para todos los temas. Al reanudar tras pausa lo pendiente corre sin esperar la ventana de 5 s.
- [D-010] 2026-09-22 (T-008) La identidad del operador se canta en un solo lugar: la barra superior. Ninguna pantalla del POS vuelve a saludar ni a repetir el nombre del viewer (HoyGate es la excepción: es gate, no vista).
- [D-011] 2026-09-22 (T-009) Alcance de [D-010]: prohíbe saludos e identidad decorativa repetida, no la atribución operativa. El CTA de cobro y la confirmación de pago sí declaran al operador ('Cobrar … como {PrimerNombre}'); fuera del momento del cobro sigue valiendo D-010 tal cual.
- [D-012] 2026-09-22 (T-009) El nombre del operador en el cobro es el de la SESIÓN (viewer.staff.fullName), nunca el del barbero atribuido a las líneas: quien cambie esto rompe el escenario que motivó R9.
- [D-013] 2026-09-22 (T-010) La etiqueta roja de conexión caída (SIN CONEXIÓN EN VIVO) nunca se oculta por ancho; lo que cede en pantallas chicas es sólo el texto de la hora del RefreshControl.
