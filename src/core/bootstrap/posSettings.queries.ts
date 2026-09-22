import { graphql } from '@/core/graphql/generated'

/**
 * Ajustes del negocio que necesita el POS (spec § 3.2). El dueño los edita en
 * el admin ("Ajustes del negocio") y aquí sólo se LEEN: la validación de
 * límites vive en el API.
 *
 * Deliberadamente diminuto: de todo `TenantSetting` sólo viajan los dos
 * tiempos del bloqueo automático, que son los únicos que el cliente necesita
 * para decidir algo. `salesCorrectionWindowDays` y la tasa de IVA no se piden
 * — las resuelve el API en sus propias respuestas.
 *
 * Sin permiso especial: cualquier sesión de staff del POS puede leerlo (no es
 * dinero ni PII). Aun así sólo se consulta con sesión, ver `usePosSettings`.
 */
export const POS_SETTINGS = graphql(`
  query PosSettings {
    posSettings {
      posAutoLockIdleSeconds
      posAutoLockCheckoutSeconds
    }
  }
`)
