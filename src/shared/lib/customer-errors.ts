import { CombinedGraphQLErrors } from '@apollo/client/errors'

/**
 * Dominio: colisión de nombre al crear un cliente LOCAL (identidad-clientes
 * spec, API). El API detecta la carrera — dos POS/checkouts creando el mismo
 * `normalizedName` casi al mismo tiempo — vía el índice único parcial
 * `Customer_tenantId_normalizedName_local_key`, y devuelve un `GraphQLError`
 * con `extensions.code = 'CUSTOMER_NAME_TAKEN'` + `extensions.existingCustomerId`
 * (ver `bienbravo-api/src/common/customer-name.ts#customerNameTakenError`).
 *
 * Tanto `createWalkIn` como `findOrCreateCustomer` comparten ese helper de
 * dominio en el API, así que el cliente comparte también esta excepción —
 * evita duplicar el parsing de `CombinedGraphQLErrors` en cada repository.
 *
 * `message` ya viene en español, listo para mostrar tal cual al operador.
 */
export class CustomerNameTakenException extends Error {
  readonly existingCustomerId: string | null
  constructor(message: string, existingCustomerId: string | null) {
    super(message)
    this.name = 'CustomerNameTakenException'
    this.existingCustomerId = existingCustomerId
  }
}

/**
 * Traduce un error de Apollo a `CustomerNameTakenException` cuando el server
 * marcó `extensions.code === 'CUSTOMER_NAME_TAKEN'`. Devuelve `null` para
 * cualquier otro error (incluyendo errores que no son de GraphQL) — el
 * caller debe re-lanzar el error original en ese caso, no tragárselo.
 */
export function toCustomerNameTakenException(err: unknown): CustomerNameTakenException | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const first = err.errors[0]
  const ext = first?.extensions
  if (ext?.code !== 'CUSTOMER_NAME_TAKEN') return null
  const existingCustomerId = typeof ext.existingCustomerId === 'string' ? ext.existingCustomerId : null
  return new CustomerNameTakenException(first.message, existingCustomerId)
}
