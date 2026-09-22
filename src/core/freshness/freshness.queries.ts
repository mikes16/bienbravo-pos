import { graphql } from '@/core/graphql/generated'

/**
 * Aviso genérico de "algo que el POS muestra cambió en esta sucursal"
 * (spec § 3.3 c). Cubre el hueco que dejan las tres suscripciones de Hoy
 * (venta, fila, cita): otra iPad abre o cierra la caja; el admin corrige la
 * forma de pago de una venta, edita una comisión, cambia un precio del
 * catálogo o los ajustes del negocio.
 *
 * La carga útil es mínima a propósito — `kind` + sucursal + hora, sin montos
 * ni nombres: es un ping de invalidación, no el dato. El dato viaja después
 * por la consulta HTTP autenticada del tema correspondiente.
 *
 * `kind` es `PosDataEventKind` (CATALOG | COMMISSION | PAYMENT | REGISTER |
 * SETTINGS). El mapa kind → temas vive en `FreshnessProvider`, que es quien
 * conoce los temas del canal.
 */
export const POS_DATA_CHANGED = graphql(`
  subscription PosDataChanged($slug: String!) {
    posDataChanged(slug: $slug) {
      kind
      locationSlug
      occurredAt
    }
  }
`)
