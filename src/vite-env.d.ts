/// <reference types="vite/client" />

/**
 * Identificador del build, inyectado por Vite con `define` (ver vite.config.ts).
 * Es la versión del cache persistido en el dispositivo: cada deploy trae un
 * valor distinto y purga ese cache una sola vez.
 *
 * Solo existe en bundles hechos por Vite. Bajo vitest el `define` no se aplica,
 * así que quien lo lea debe protegerlo con `typeof __BUILD_ID__` (lo hace
 * src/core/apollo/client.ts).
 */
declare const __BUILD_ID__: string
