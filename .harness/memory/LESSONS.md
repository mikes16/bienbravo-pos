# LESSONS — lecciones aprendidas

<!-- ≤60 líneas. SOLO vía `harness.mjs add-lesson`.
     Formato de entrada: "[tag] (xN, T-XXX/T-YYY) regla generalizable".
     Tags cerrados: test | estilo | api | deps | build | datos | seguridad. -->
- [test] (x1, T-001) Un array/objeto literal pasado como prop a un hook y usado como dependencia de useEffect reprograma el efecto en cada render: usar constante de módulo o useMemo cuando el efecto agenda timers.
- [build] (x1, T-003) Un check de grep puede pasar desde antes del cambio: contrástalo con git show HEAD:<archivo> para confirmar que el criterio depende del diff.
- [build] (x1, T-004) Si cambias una query graphql(), corre npm run codegen y commitea src/core/graphql/generated/: sin eso typecheck y el check de drift de CI fallan.
- [build] (x1, T-004) Antes de dar un check de lint por roto, mide el baseline (npm run lint + comentarios de .github/workflows/ci.yml): si los errores son pre-existentes, el arreglo mínimo va en el archivo de tu alcance, no en la config global.
- [seguridad] (x1, T-005) Todo caché que se escriba en el dispositivo debe filtrarse con lista de permitidos y comprobarse con un test que busque las cifras/PII literales en el payload serializado (not.toContain): la aserción por llaves deja pasar datos anidados.
- [build] (x1, T-005) Si inyectas un global con define de Vite, confirma que quedó inlineado en dist (grep del identificador en el bundle): el build pasa igual si el define no se aplicó.
- [test] (x1, T-006) En jsdom no hay layout ni media queries: asertar área táctil con toHaveStyle sobre estilo inline y prefers-reduced-motion vía la variante motion-reduce: emitida en el markup, nunca píxeles medidos.
- [build] (x1, T-007) Un check ! grep -q '<token>' <archivo> también lee los comentarios: describe la prohibición en el docblock sin escribir el token prohibido.
- [test] (x1, T-008) El orden visual 'X debajo de Y' se asierta en jsdom con compareDocumentPosition entre nodos hallados por texto, no por clases ni estructura del DOM (jsdom no tiene layout).
- [test] (x1, T-008) En esta máquina no existe el timeout de coreutils (exit 127): acota los checks con el parámetro timeout de Bash, no con el binario.
- [build] (x1, T-002a) react-hooks/set-state-in-effect es inter-procedural: si sigue avisando tras cambiar solo los args, el setState vive dentro del useCallback invocado; inlinea el fetch en el efecto de mount con .then/.catch/.finally y bandera cancelled.
- [build] (x1, T-002b) Estado derivado de una prop se ajusta en el render comparando contra un prevProp guardado en state; el useEffect solo programa/cancela el timer y el setState vive en su callback.
- [build] (x1, T-002c) Un script npm con target fijo (eslint .) no se puede acotar con -- <ruta>: npm anexa los args y lintea el repo entero; usa npm run lint:path -- <ruta> (script gemelo sin target) para medir un feature.
- [build] (x1, T-009) Exportar un helper que no es componente desde un .tsx de componente dispara react-refresh/only-export-components: ponlo en su propio módulo o duplícalo local.
