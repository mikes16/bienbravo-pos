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
