import { graphql } from '@/core/graphql/generated'

/**
 * Query diminuto del "gate" de catálogo. Devuelve solo un hash. El POS lo
 * compara con el hash persistido para decidir si su cache de catálogo sigue
 * vigente — sin volver a bajar el catálogo completo si nada cambió.
 *
 * No definimos un `posBootstrap` gordo a propósito: el BatchHttpLink ya
 * coalesce las queries de catálogo (barbers/services/products/combos/
 * categories) en un solo POST, así que un tipo compuesto agregaría superficie
 * de schema sin ahorrar un round-trip.
 */
export const POS_CATALOG_VERSION = graphql(`
  query PosCatalogVersion($locationId: ID!) {
    catalogVersion(locationId: $locationId)
  }
`)
