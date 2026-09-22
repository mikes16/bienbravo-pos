import { describe, it, expect, vi } from 'vitest'
import type { ApolloClient } from '@apollo/client'
import { ApolloDaySalesRepository, POS_DAY_SALES } from './day-sales.repository'

/**
 * Regla del dueño (18 sep 2026): el dinero NUNCA se muestra desde lo ya
 * guardado. `posDaySales` es clase DINERO/SENSIBLE, así que esta consulta
 * siempre viaja al servidor — es la causa raíz de R8 ($500 de ayer mientras
 * la sucursal ya llevaba $3,720).
 */
describe('ApolloDaySalesRepository', () => {
  function fakeClient() {
    const query = vi.fn().mockResolvedValue({ data: { posDaySales: [] } })
    return { client: { query } as unknown as ApolloClient, query }
  }

  it('always goes to the network', async () => {
    const { client, query } = fakeClient()
    await new ApolloDaySalesRepository(client).getDaySales('loc-1', '2026-09-18')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith({
      query: POS_DAY_SALES,
      variables: { locationId: 'loc-1', date: '2026-09-18' },
      fetchPolicy: 'network-only',
    })
  })

  it('maps an empty day to an empty list without failing', async () => {
    const { client } = fakeClient()
    await expect(new ApolloDaySalesRepository(client).getDaySales('loc-1', '2026-09-18')).resolves.toEqual([])
  })
})
