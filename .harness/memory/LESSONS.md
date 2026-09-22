# LESSONS — lecciones aprendidas

<!-- ≤60 líneas. SOLO vía `harness.mjs add-lesson`.
     Formato de entrada: "[tag] (xN, T-XXX/T-YYY) regla generalizable".
     Tags cerrados: test | estilo | api | deps | build | datos | seguridad. -->
- [test] (x1, T-001) Un array/objeto literal pasado como prop a un hook y usado como dependencia de useEffect reprograma el efecto en cada render: usar constante de módulo o useMemo cuando el efecto agenda timers.
- [build] (x1, T-003) Un check de grep puede pasar desde antes del cambio: contrástalo con git show HEAD:<archivo> para confirmar que el criterio depende del diff.
- [build] (x1, T-004) Si cambias una query graphql(), corre npm run codegen y commitea src/core/graphql/generated/: sin eso typecheck y el check de drift de CI fallan.
- [build] (x1, T-004) Antes de dar un check de lint por roto, mide el baseline (npm run lint + comentarios de .github/workflows/ci.yml): si los errores son pre-existentes, el arreglo mínimo va en el archivo de tu alcance, no en la config global.
