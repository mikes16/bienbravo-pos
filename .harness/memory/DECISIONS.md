# DECISIONS — decisiones vigentes

<!-- ≤80 líneas. Append-only, SOLO vía `harness.mjs add-decision`.
     Formato de entrada: "[D-NNN] fecha-iso (T-NNN) texto".
     Sustitución: la vieja se reescribe como "[D-OLD] SUSTITUIDA por D-NNN".
     Precedencia en los agentes: DECISIONS > PROFILE > criterio propio. -->
- [D-001] 2026-09-22 (T-004) Las ventanas de staffWorkingWindows se consumen en el orden que las devuelve el API (ya ordenadas por startMin, mismo motor que payroll); el POS no reordena ni fusiona.
- [D-002] 2026-09-22 (T-004) src/test/mocks/repositories.ts desactiva @typescript-eslint/no-unused-vars a nivel archivo para cumplir el lint sobre el baseline de errores pre-existentes que ci.yml documenta; el arreglo de fondo (argsIgnorePattern '^_' en eslint.config.js) queda pendiente como chore.
