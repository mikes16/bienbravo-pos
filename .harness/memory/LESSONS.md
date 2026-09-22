# LESSONS — lecciones aprendidas

<!-- ≤60 líneas. SOLO vía `harness.mjs add-lesson`.
     Formato de entrada: "[tag] (xN, T-XXX/T-YYY) regla generalizable".
     Tags cerrados: test | estilo | api | deps | build | datos | seguridad. -->
- [test] (x1, T-001) Un array/objeto literal pasado como prop a un hook y usado como dependencia de useEffect reprograma el efecto en cada render: usar constante de módulo o useMemo cuando el efecto agenda timers.
- [build] (x1, T-003) Un check de grep puede pasar desde antes del cambio: contrástalo con git show HEAD:<archivo> para confirmar que el criterio depende del diff.
