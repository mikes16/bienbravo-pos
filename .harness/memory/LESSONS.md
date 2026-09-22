# LESSONS — lecciones aprendidas

<!-- ≤60 líneas. SOLO vía `harness.mjs add-lesson`.
     Formato de entrada: "[tag] (xN, T-XXX/T-YYY) regla generalizable".
     Tags cerrados: test | estilo | api | deps | build | datos | seguridad. -->
- [test] (x1, T-001) Un array/objeto literal pasado como prop a un hook y usado como dependencia de useEffect reprograma el efecto en cada render: usar constante de módulo o useMemo cuando el efecto agenda timers.
