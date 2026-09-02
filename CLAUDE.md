# bienbravo-pos — Claude notes

Point of sale para sucursal. Stack: Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3.

Ver [../CLAUDE.md](../CLAUDE.md) para el contexto global del repo BienBravo (API, admin, pos, web) y [../bienbravo-api/docs/BUSINESS_RULES.md](../bienbravo-api/docs/BUSINESS_RULES.md) para las reglas de negocio.

## GraphQL types

Los tipos de cada query/mutation se generan desde el schema del API con `graphql-codegen`. Viven en [src/core/graphql/generated/](src/core/graphql/generated/) y se commitean.

**Cuando el schema del API cambia:**

1. Asegúrate de que `../bienbravo-api` esté clonado como sibling y tenga el `schema.generated.graphql` actualizado
2. Desde este repo:
   ```bash
   npm run sync-schema   # copia schema del API → ./schema.graphql
   npm run codegen       # regenera src/core/graphql/generated/
   ```
3. Commitea juntos `schema.graphql` y los archivos regenerados de `src/core/graphql/generated/`

**Cuando escribas una nueva query/mutation:**

Usa la función `graphql()` de `@/core/graphql/generated`, **no** `gql` de `@apollo/client`:

```ts
import { graphql } from '@/core/graphql/generated'

export const MY_QUERY = graphql(`
  query MyQuery($id: ID!) { ... }
`)
```

`useQuery(MY_QUERY)` auto-infiere `data` y `variables`. Corre `npm run codegen:watch` durante desarrollo para regenerar en cada save.

**CI enforcement:** el workflow de CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre `npm run codegen` y falla si el `src/core/graphql/generated/` commiteado difiere del que produce codegen. Si el check de "codegen drift" falla en tu PR, corre `npm run codegen` localmente y commitea el resultado.

## TypeScript project references

`tsconfig.generated.json` aísla `src/core/graphql/generated/` con flags relajados (`erasableSyntaxOnly: false`, `noUnusedLocals: false`) porque client-preset emite enums y exports que violan las reglas estrictas del resto del repo. `tsconfig.app.json` excluye ese directorio y lo referencia como proyecto separado. No tocar esta estructura salvo que sepas que lo necesitas.

## Design tokens (vendoring)

Los design tokens viven físicamente en `src/styles/design-tokens/bienbravo.tokens.css`. Antes era un symlink a `../bienbravo-admin/design-system/tokens/dist/`, pero el deploy a Vercel rompe symlinks cross-repo. Ahora es una copia.

**Cuando los tokens cambien en `bienbravo-admin`:**

1. En `bienbravo-admin/`, regenerar tokens: `npm run ds:build-tokens`
2. Copiar el archivo nuevo:
   ```bash
   cp /path/to/bienbravo-admin/design-system/tokens/dist/bienbravo.tokens.css src/styles/design-tokens/bienbravo.tokens.css
   ```
3. Commit en este repo

Nota: solo se vendoriza `bienbravo.tokens.css` (base). `bienbravo.admin.tokens.css` es específica del admin y no aplica aquí.

<!-- harness-base -->
# Reglas del harness (anexado por harness-base — no editar a mano)

Este proyecto opera con un harness de equipo: orquestador (`/harness-run`),
ejecutor Jr/Sr, reviewer y principal-reviewer, sobre una cola de tareas en
`tasks.json`.

## Regla primera: el disco manda
- **El disco manda.** Ignora todo estado del harness que "recuerdes" de la
  conversación: tras compactación o resume es cache desconfiable. Si `tasks.json`
  tiene tareas `in_progress` o `in_review`, ejecuta el protocolo de re-entrada de
  `/harness-run` ANTES de cualquier otra acción.

## Escritura de estado: solo por CLI
- `tasks.json` y `.harness/memory/**` NUNCA se editan con Write/Edit ni con
  redirecciones de shell: la única vía es `node .harness/scripts/harness.mjs
  <comando>`. Un hook deniega las demás vías; no intentes rodearlo.
- Los commits que cierran tareas los ejecuta el CLI (`approve` y las transiciones
  a blocked/split). No corras `git commit` manual sobre trabajo del harness.

## Comandos Bash: uno por llamada
- Prohibido encadenar con `&&`, `;` o `|` en cualquier Bash del harness: las
  reglas de permiso son de prefijo y un comando compuesto dispara un prompt de
  permiso con el usuario ausente. Un comando por llamada, siempre.

## Jerarquía del equipo
- Jr (`executor-jr`, sonnet): tareas mecánicas — `type` chore y curation.
- Sr (`executor`, opus): feature y fix, y SIEMPRE los reintentos, sea cual sea
  el tipo.
- Peer reviewer (`reviewer`, opus): gate por tarea, veredicto antes de cerrarla.
- Principal (`principal-reviewer`, fable): review final de la corrida — código,
  prácticas y seguridad; sus Critical/Important se vuelven tareas antes de cerrar.

## Roles: quién ve qué
- El orquestador nunca lee código fuente, nunca abre `.harness/runs/*/logs/` y
  nunca re-cita reportes o veredictos ya persistidos: despacha punteros.
- Ejecutor y revisor siguen sus protocolos (`.claude/agents/executor.md`,
  `.claude/agents/reviewer.md`); su resultado vive en archivos bajo
  `.harness/runs/` y su mensaje final es solo un acuse (≤3 líneas).
