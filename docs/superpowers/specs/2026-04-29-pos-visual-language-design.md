# POS Visual Language + Roadmap — Design

**Status:** Approved decisions captured 2026-04-29
**Author:** mlopez@insightcoll.com (with Claude)
**Scope:** Sub-project #0 of the POS rework. Defines the visual language and component vocabulary that all subsequent sub-projects will use. Also documents the full POS sub-project roadmap as a meta-plan.

---

## Context

Operadores objetivo: cajeros / barberos no power-user. La meta es **0 fricción**: una sola pantalla a la vez, una sola decisión a la vez, tipos grandes, contraste alto, lenguaje claro en sentence case sin jerga editorial.

El POS hoy ya existe pero "no funciona bien" — tiene la arquitectura limpia (Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo v4 + Vitest, features con `domain/application/data/presentation`) y 8 features esqueleto (auth, home, checkout, register, walkins, agenda, clock, my-day), pero el lenguaje visual es inconsistente y la UX tiene fricciones. Este sub-proyecto define la foundation; los siguientes 10 sub-proyectos rediseñan cada feature sobre esa foundation.

---

## Roadmap completo del POS rework

Cada sub-proyecto = su propio spec → plan → implementation cycle. Mergean en orden (cada uno asume que el anterior está en main).

| # | Sub-proyecto | Scope | Prerrequisito |
|---|---|---|---|
| **0** | **Visual Language (este spec)** | Tokens, component vocabulary, design system POS | — |
| **1** | **Lock screen + sesión POS** | PIN, lockout, idle-timeout, session swap entre operadores | #0 |
| **2** | **Home / Launcher** | Status board + feature picker | #0, #1 |
| **3** | **Caja: open/close** | Abrir con float, contar, cerrar, reconciliación | #0 |
| **4** | **Checkout: catálogo + cart** | Agregar items, asignar barbero, validar stock — el corazón del POS | #0, #3 |
| **5** | **Checkout: customer + payment + receipt** | Multi-recipient (papá+hijos), métodos de pago, partial payments, success | #4 |
| **6** | **Walk-ins** | Queue, asignación a barbero, transición a Checkout | #0, #2 |
| **7** | **Agenda integration** | Citas del día, check-in, transición a Checkout | #0, #2 |
| **8** | **Clock** | Reloj checador, pendientes | #0 |
| **9** | **My Day** | KPIs personales del operador | #0 |
| **10** | **Refunds + voids** | Flujos de reembolso aprobados | #4, #5 |

### Out of scope para esta fase del rework

- Modo offline / sync (operador siempre tiene WiFi en sucursal)
- Hardware physical (impresora térmica, cash drawer, scanner) — los hooks del API existen, integración es tier 2
- Reporting cross-shift y handoff entre operadores
- Multi-register simultáneo (el API ya garantiza "un open session por sucursal")
- iPhone / phone target (este POS es iPad. App phone para barbero es producto distinto)

### Acceptance test cross-cutting (sub-#5)

**Caso "papá + 2 hijos = 3 barberos, 1 cuenta"** debe pasar antes de mergear el sub-proyecto #5:

1. Una sola venta (un único `Sale`) — el papá paga todo en una transacción.
2. Cada `SaleItem` (servicio o producto) atribuido al barbero correcto via `staffUserId`.
3. Las comisiones del API se calculan correctamente porque cada SaleItem apunta al barbero real.
4. El recibo / success state muestra al papá el desglose claro: "3 cortes + 1 pomada" con el barbero por línea.
5. El cajero debe poder cobrar al papá en menos de **60 segundos** sin re-revisar quién hizo qué.

(Memoria: `project_pos_split_attribution.md`.)

---

## Decisiones de diseño (sub-proyecto #0)

### 1. Visual direction → **Direction B: mismo DNA admin, modo POS calmado**

- **Misma paleta** del admin: bravo / carbon / cuero / leather / bone / success / warning.
- **Mismas fuentes**: Manrope (body / chrome) + Barlow Condensed (numerals heros).
- **Sharp corners 0px** en todo surface (heredado del admin sin excepción, salvo avatares y status dots).
- **Diferencia clave vs admin**: tipos +30%, botones 56-64px, sentence case en chrome operacional (no UPPERCASE TRACKED), más respiro vertical, menos editorial chrome density.
- La marca lee igual; el ritmo es para cajeros no power-user.

Razonamiento: el admin ya tiene una identidad sólida ("Editorial dark luxury"). Direction A (1:1 admin) pesa para cajeros — jerga editorial es para staff técnico. Direction C (identidad sibling distinta) abre un segundo design system para mantener — caro y arriesgado. B preserva la marca y ajusta el ritmo.

### 2. Layout primitive del Checkout → **Wizard step-by-step**

- **Una cosa a la vez**: catálogo → cliente → pago → success.
- Cart vive en una **CartBar persistente abajo** con total + count siempre visible. Tap para expandir detalle (CartSheet).
- Hick's Law: menos opciones simultáneas = decisiones más rápidas.
- El caso "papá + hijos + 3 barberos" se resuelve en sub-#5 con un step explícito tipo "¿quién recibe este servicio?" — el wizard lo soporta sin cambiar el modelo.

Razonamiento: two-pane (Square / Toast) es excelente para cajeros expertos pero más denso. Stacked es para futuros tablets / phones chicos. Wizard alinea con "0 fricción no power-user".

### 3. Device target → **iPad landscape 10–11″ (1024×768 / 1180×820)**

- **Un dispositivo, una orientación**. No responsive más allá de eso.
- Si en el futuro quieren phone para barbero, eso es un app distinto (ej "mi día" mobile), no este POS.
- Portrait existe pero es modo lock / pantalla en pausa, no operación principal.

### 4. Foundation tokens

#### Type scale

| Token | Size | Family | Use |
|---|---|---|---|
| `caption` | 13px | Manrope 500 | Mesa 3 · 14:30 |
| `eyebrow` | 13px | Manrope 500 | Carrito · Centro |
| `label` | 14px | Manrope 500 | Total a cobrar |
| `body` | 16px | Manrope 500 | Corte clásico (line items) |
| `body-lg` | 18px | Manrope 500 | Cliente · Mesa 3 |
| `subtitle` | 22px | Manrope 700 -0.01em | ¿Qué se vendió? |
| `heading` | 28px | Manrope 700 -0.01em | Catálogo |
| `numeral-S` | 36px | Barlow Cond. 800 | $250 (line price) |
| `numeral-M` | 56px | Barlow Cond. 800 | $820 (cart total) |
| `numeral-L` | 88px | Barlow Cond. 800 | $3,420 (caja total) |

Tracking: tight (-0.01em) en headings, neutral en body, wide (0.16em) solo en mono captions.

Manrope + Barlow Condensed continúan heredados del admin via `design-system/tokens/dist/bienbravo.tokens.css`. No nuevos faces.

#### Touch target tiers

| Token | Height | Use |
|---|---|---|
| `touch-min` | 40px | Inline taps en chrome (chevron, close ×, "cancelar" secundario) |
| `touch-row` | 48px | Filas en listas tappables |
| `touch-secondary` | 56px | Acciones secundarias (Editar, Agregar otro) |
| `touch-primary` | 64px | CTAs primarias (Cobrar, Siguiente, Confirmar) |
| `touch-numpad` | 72px | Keys de Numpad (alta frecuencia tactile) |

Regla: cualquier acción primaria viva en 56-64px. 40px solo para escape hatches del chrome.

#### Spacing scale (4px base)

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80`

- Section gap: 32-40px
- Padding interno de panels: 20-24px
- Gap entre items en lista: 12-16px
- Cero valores arbitrarios — todo es múltiplo de 4.

#### Color tokens (heredados del admin)

| Role | Token | Hex |
|---|---|---|
| Page bg | `--color-carbon` | `#0f0e0e` |
| Surface elevated | `--color-carbon-elevated` | `#1a1918` |
| Surface panel | `--color-carbon-panel` | `#252422` |
| Tile bg | `--color-cuero-viejo` | `#2a221f` |
| Tile hover | `--color-cuero-viejo-hover` | `#352c28` |
| Text primary | `--color-bone` | `#e8e4df` |
| Text muted | `--color-bone-muted` | `#9a958f` |
| Text dim | `--color-leather` | `#8b7355` |
| Borders / rules | `--color-leather-muted` | `#5c4d3d` |
| Primary CTA · danger | `--color-bravo` | `#c41e3a` |
| Success | `--color-success` | `#6b8a73` |
| Warning | `--color-warning` | `#a87a3a` |

Reglas semánticas POS-específicas:
- **Bravo se reserva para CTAs primarias y peligros** — no para indicadores de estado neutrales.
- **Success y warning visualmente diferenciados** — el cajero los distingue sin pensar.
- Bone (`#e8e4df`) sobre carbon — alto contraste, OK para body.
- Bone-muted (`#9a958f`) sobre carbon — borderline AA, solo para captions / metadata.

#### Corners

**Sharp 0px en TODO surface, button, tile, sheet.** Excepciones:
- Avatares — `rounded-full`.
- Status dots — `rounded-full` (h-2 w-2 indicador).

No hay `rounded-md`, `rounded-lg`, `rounded-xl` en ningún surface del POS. Los radii actuales en `index.css` POS-specific (`--radius-bb-card: 16px`, `--radius-bb-control: 12px`) se eliminan / overridean a 0px.

#### Motion

| Use case | Duration | Easing |
|---|---|---|
| Tap feedback (button press) | 150ms | `ease-out` |
| Sheet open (cart detail, picker) | 280ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Sheet close | 220ms | `ease-in` |
| Wizard step transition | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) |
| Toast / system message | 240ms in / 200ms out | `ease-out / ease-in` |
| Loading skeleton pulse | 1500ms loop | `ease-in-out` |

Respect `prefers-reduced-motion`: wrap todas las animaciones no esenciales en la media query.

### 5. Accessibility (defaults)

- **WCAG 2.2 AA mínimo** — 4.5:1 body, 3:1 large text + UI components.
- **Keyboard navigable**: cada interactive reachable via Tab, focus rings visibles 2px bravo con 2px offset.
- **Semantic HTML first**: `<button>` para clicks, `<a>` para navegación, etc.
- **Touch targets**: mínimo 40px (chrome) — operacionalmente 56-64px.
- **Heading hierarchy**: un `<h1>` por vista, sin saltos de h2 a h4.
- `prefers-reduced-motion`: respect siempre.
- Labels visibles (no solo placeholders) en inputs.

### 6. UX principles POS-específicos

- **Una decisión a la vez** (Hick's Law). Un solo focal point por pantalla.
- **Visibility of system status**: caja abierta/cerrada, sesión activa, total del carrito — siempre visibles.
- **Recognition over recall**: nombres claros, sentence case, sin jerga interna ("walk-in" sí, "resource" no).
- **Error prevention**: confirmar acciones destructivas (cancelar venta, cerrar caja), validar antes de submit, deshabilitar estados imposibles.
- **Match real world**: vocabulario del cajero ("papá paga todo", "barba", "fade") no del modelo de datos ("SaleItem", "extras").
- **Single tap default**: cada acción común completable en 1 tap. 2 taps OK para acciones secundarias. >3 taps = redesign.
- **Sin animaciones decorativas**: motion solo donde comunica causalidad o estado.
- **Cero "Awesome!" / "Oops!"**: tono profesional, mexicano, conciso.

---

## Component vocabulary

~30 componentes nuevos POS-específicos, organizados por sub-proyecto. Componentes del admin DS (`Button`, `Input`, `Sheet`, `Toast`, `Avatar`, `Badge`, `EditorialHeader`, `DataTable`, `BranchScopeTrigger`, etc.) se reusan donde aplican.

### Foundation (sub-#0)

| Component | Purpose |
|---|---|
| `<WizardShell>` | Page template del checkout: step bar arriba + área de contenido + CTA bar abajo |
| `<StepBar>` | Indicador horizontal "Catálogo › Cliente › Pago" |
| `<MoneyDisplay>` | Barlow Condensed numeral con currency separator |
| `<MoneyInput>` | Display grande + numpad implícito (cash, propinas) |
| `<Numpad>` | Numérico 3×4, key 72px |
| `<PinKeypad>` | Variante 4×3 para PIN del lock |
| `<EmptyState>` | POS-styled empty con tipografía (no íconos cute) |
| `<SuccessSplash>` | Full-screen success state |
| `<TouchButton>` | Wrapper sobre admin Button con sizes POS |
| `<TileGrid>` | Grid responsive de tiles cuadradas |

### Lock / Auth (sub-#1)

| Component | Purpose |
|---|---|
| `<LockScreen>` | Full-screen branding + PIN entry |
| `<OperatorAvatar>` | Avatar circular grande para "tap to switch operator" |

### Home (sub-#2)

| Component | Purpose |
|---|---|
| `<FeatureTile>` | Tile grande de feature (Checkout, Caja, Walkins, Agenda) con icon + label sentence case |
| `<StatusBoard>` | Barra arriba con caja status / clock status / día actual |

### Caja (sub-#3)

| Component | Purpose |
|---|---|
| `<RegisterStatusBar>` | Banner de caja abierta / cerrada (gating de checkout) |
| `<DenominationCounter>` | Fila por denominación ($500 × 4 = $2000), tap para ajustar |
| `<CashCountSheet>` | Sheet de close-register con denominaciones + total |

### Checkout (sub-#4 y #5)

| Component | Purpose |
|---|---|
| `<CategoryPills>` | Horizontal scrollable filter al top del catálogo |
| `<CategoryTile>` | Tile cuadrada con nombre + precio, tap para agregar |
| `<CartBar>` | Barra inferior persistente con total + count + "Siguiente" |
| `<CartSheet>` | Vista expandida del carrito |
| `<CartRow>` | Line item con nombre + barbero + precio + chevron |
| `<RecipientCard>` | Colapsible card por persona (caso papá+hijos) |
| `<AddRecipientButton>` | "+ Otra persona" |
| `<BarberPicker>` | Sheet/popover para asignar barbero |
| `<CustomerLookupSheet>` | Search input + results list |
| `<PaymentMethodCard>` | Card grande Efectivo / Tarjeta / Transferencia |
| `<TipSelector>` | Quick-pick propina (10/15/20/Otro) |

### Walkins (sub-#6)

| Component | Purpose |
|---|---|
| `<WalkinQueueRow>` | Cliente en cola con nombre + minutos + barbero |
| `<BarberSlotCard>` | Card de barbero con disponibilidad / cliente actual / cola |

### Agenda (sub-#7)

| Component | Purpose |
|---|---|
| `<AppointmentCard>` | Bloque de cita con cliente + servicio + status + acciones |

### Clock (sub-#8)

| Component | Purpose |
|---|---|
| `<ClockButton>` | Botón gigante "Entrada" / "Salida" con timestamp |
| `<ClockHistoryRow>` | Entry pasada con fecha + tipo |

### My Day (sub-#9)

| Component | Purpose |
|---|---|
| `<KPICard>` | KPI numeral + label + trend |

---

## Acceptance del sub-proyecto #0 (Visual Language)

- [ ] Tokens (type, touch, spacing, color, motion) definidos en CSS variables y exportados desde `src/index.css` o equivalente.
- [ ] Foundation components (WizardShell, StepBar, MoneyDisplay, MoneyInput, Numpad, PinKeypad, EmptyState, SuccessSplash, TouchButton, TileGrid) implementados con TypeScript types y tests/visual stories básicos.
- [ ] Sample screen ("Hello POS" con un Wizard de prueba que use foundation components) renderea correctamente en iPad landscape 10–11″ a 1024×768.
- [ ] Lint + typecheck + build limpios.
- [ ] WCAG AA verificado en spot-check: contrast ratios, keyboard nav, focus rings.
- [ ] El doc de tokens vivo en `docs/` para que sub-proyectos posteriores lo referencien.

---

## Risks

- **Component scope creep**: la lista de ~30 componentes puede crecer en cada sub-proyecto. Mitigación: cada sub-proyecto solo agrega componentes específicos a su feature; los foundation se cierran en sub-#0.
- **Performance**: muchas Manrope + Barlow Condensed weights cargadas pesan el bundle. Mitigación: subset a glyphs latin-MX, weights solo 500/700/800 (no 100-900). Self-hosted via design-system tokens existentes.
- **Reuse vs reinvent**: algunos componentes admin (BranchScopeTrigger, EditorialHeader) podrían no aplicar al POS. Mitigación: cada sub-proyecto identifica qué del admin reusa explícitamente; lo demás es POS-only.
- **Symlink fragility**: `bienbravo-pos/design-system -> ../bienbravo-admin/design-system` — si admin tokens cambian, POS hereda. Beneficio (consistencia) > riesgo (regression cross-repo). Mitigación: si POS necesita override, vive en `src/index.css` POS-specific layer, no en design-system.

---

## Tamaño estimado del sub-proyecto #0

- **Token CSS**: ~80 LoC en `src/index.css`
- **10 foundation components**: ~150 LoC promedio = ~1500 LoC
- **Visual stories / sample screen**: ~200 LoC
- **Tests** (vitest existe en POS): ~300 LoC
- **Net**: ~2000 LoC

Estimado **3-5 PRs** para sub-#0:
1. Token CSS + design tokens TypeScript types
2. Foundation primitives (TouchButton, TileGrid, MoneyDisplay, MoneyInput, EmptyState, SuccessSplash)
3. Numpad + PinKeypad (heavy components, separate PR)
4. WizardShell + StepBar
5. Sample screen + a11y verification
