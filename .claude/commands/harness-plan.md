---
description: Planner del harness — conversa el objetivo, redacta la cola en .harness/plan/draft.json, la itera contra el lint y la instala con import. Primera corrida: onboarding del brief.
---

# /harness-plan — planner

Conviertes un objetivo en tareas ejecutables. Todo lo que instalas pasa por
`node .harness/scripts/harness.mjs ...`; nunca editas `tasks.json` ni
`.harness/memory/**` a mano (un hook lo deniega). Un comando Bash por llamada
(sin `&&`, `;`, `|`).

## 0. Onboarding (solo si PROJECT.md está vacío)

Lee `.harness/memory/PROJECT.md`. Si no tiene contenido bajo sus encabezados
(instalación recién hecha), conversa el brief con el usuario ANTES de planear:
qué es el proyecto (2–3 líneas), stack con versiones, estructura real de
carpetas (verifícala con Glob, no de memoria) y convenciones ya existentes.
Escribe el borrador en `.harness/plan/PROJECT.draft.md` (misma estructura de
encabezados que `.harness/templates/PROJECT.md`, ≤60 líneas) e instálalo:
`node .harness/scripts/harness.mjs memory-init --file .harness/plan/PROJECT.draft.md`

## 1. Conversar el objetivo

Antes de escribir tareas entiende: qué se quiere construir, qué existe ya, qué
orden de dependencias tiene sentido y qué es verificable mecánicamente. Tú SÍ
puedes leer specs y código (a diferencia del orquestador): pagas el contexto de
planeación una sola vez, aquí.

## 2. Borrador

Escribe `.harness/plan/draft.json` (ruta NO protegida) con forma
{"tasks": [ ... ]}. Cada tarea va SIN id, status, attempts, redispatches,
split_from ni review_feedback (los pone el CLI). Campos:

- title: UNA sola intención (un "y" suele delatar dos tareas).
- description: ≤1200 caracteres, autocontenida — el ejecutor no ve este chat.
- acceptance_criteria: 1–5 objetos {id: "AC-n", desc, check, kind};
  kind ∈ test|build|lint|manual; check = comando que prueba el criterio (para
  manual: la instrucción de verificación humana; el lint solo advierte).
- context: ≤7 punteros {type: spec|decision|code_pattern|interface|doc, path,
  reason ≤140 chars}; paths que EXISTEN en disco. No apuntes handoffs a mano:
  se inyectan solos desde depends_on.
- files: los archivos que la tarea puede tocar (≤ files_max del perfil).
- depends_on: ids T-NNN. El CLI asigna ids consecutivos desde el siguiente
  número libre: mira el id más alto de la cola actual (puedes leer tasks.json —
  la protección es de escritura) y predice los ids de tu borrador para
  referenciar tareas del propio borrador entre sí.
- priority (1 = máxima) y type ∈ feature|fix|chore.

Tamaño: una tarea = una sesión limpia de un ejecutor. Entre una grande y dos
chicas encadenadas, elige las dos chicas.

## 3. Capa 2 — lint semántico (lo corres TÚ, aquí)

Tú tienes el texto completo de las tareas en contexto legítimamente; en régimen
de corrida nadie repite este pase. Por cada tarea del borrador verifica y
corrige antes de importar:
- ¿Cada criterio es verificable por SU check? (si el check pasaría con la
  feature rota, el criterio está mal escrito)
- ¿El título tiene UNA sola intención?
- ¿Cada reason de context conecta con algún criterio?
- ¿La description le basta a un ejecutor que no vio esta conversación?

## 4. Loop de lint (capa 1) e import

`node .harness/scripts/harness.mjs import --file .harness/plan/draft.json`
- Exit 1: lee los errores (ids, ciclos, límites del perfil, paths de context
  inexistentes...), corrige el borrador y repite. El import es atómico: no
  instala nada hasta que el lint esté en verde.
- Advertencias (p. ej. kind manual) no bloquean: revísalas y decide.
- Exit 0: el CLI imprime los ids asignados (added).

## 5. Cierre

Reporta al usuario: tareas instaladas (id — título), advertencias del lint que
quedaron, y sugiere arrancar con /harness-run. Para agregar tareas después:
mismo flujo (borrador nuevo → capa 2 → import anexa a la cola existente).
