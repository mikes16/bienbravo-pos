import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type {
  CatalogCategory,
  CatalogService,
  CatalogProduct,
  CatalogCombo,
  StockLevel,
  CreateSaleInput,
  SaleResult,
} from '../domain/checkout.types.ts'

/* ── GraphQL Documents ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FIND_OR_CREATE_MOSTRADOR_CUSTOMER = graphql(`
  mutation PosFindOrCreateMostradorCustomer {
    findOrCreateMostradorCustomer {
      id
      fullName
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BARBERS_QUERY = graphql(`
  query PosCheckoutBarbers($locationId: ID!) {
    barbers(locationId: $locationId) {
      id
      fullName
      photoUrl
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CUSTOMER_QUERY = graphql(`
  query PosCustomer($id: ID!) {
    customer(id: $id) {
      id
      fullName
      email
      phone
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WALKINS_FOR_LOOKUP_QUERY = graphql(`
  query PosWalkInsForLookup($locationId: ID!) {
    walkIns(locationId: $locationId) {
      id
      status
      assignedStaffUser { id fullName }
      customer { id fullName email phone }
    }
  }
`) as any

const CATEGORIES_QUERY = graphql(`
  query PosCatalogCategories {
    catalogCategories {
      id
      name
      slug
      sortOrder
      appliesTo
    }
  }
`)

const SERVICES_QUERY = graphql(`
  query PosServices($locationId: ID!, $staffUserId: ID) {
    services(locationId: $locationId) {
      id
      name
      basePriceCents
      baseDurationMin
      isActive
      isAddOn
      imageUrl
      categoryId
      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {
        priceCents
        durationMin
        extras {
          serviceId
          name
          priceCents
          durationMin
        }
      }
    }
  }
`)

const RESOLVE_SERVICE_PRICE_QUERY = graphql(`
  query PosResolveServicePrice($id: ID!, $locationId: ID!, $staffUserId: ID) {
    service(id: $id) {
      id
      basePriceCents
      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {
        priceCents
      }
    }
  }
`)

const PRODUCTS_QUERY = graphql(`
  query PosProducts($locationId: ID!) {
    products(locationId: $locationId) {
      id
      name
      sku
      imageUrl
      categoryId
      isActive
      variants {
        id
        priceCents
      }
    }
  }
`)

const POS_INVENTORY_LEVELS_QUERY = graphql(`
  query PosInventoryLevels($locationId: ID!) {
    posInventoryLevels(locationId: $locationId) {
      productId
      quantity
    }
  }
`)

const COMBOS_QUERY = graphql(`
  query PosCatalogCombos {
    catalogCombos(activeOnly: true) {
      id
      name
      priceCents
      imageUrl
      effectiveCategoryIds
      items {
        serviceId
        productId
        serviceName
        productName
        qty
        sortOrder
      }
    }
  }
`)

const SEARCH_CUSTOMERS_QUERY = graphql(`
  query PosSearchCustomers($query: String!, $limit: Int) {
    searchCustomers(query: $query, limit: $limit) {
      id
      fullName
      email
      phone
    }
  }
`)

const FIND_OR_CREATE_CUSTOMER = graphql(`
  mutation FindOrCreateCustomer($name: String!, $email: String, $phone: String) {
    findOrCreateCustomer(name: $name, email: $email, phone: $phone) {
      id fullName email phone
    }
  }
`)

const CREATE_POS_SALE = graphql(`
  mutation CreatePosSale($input: CreatePOSSaleInput!) {
    createPOSSale(input: $input) {
      id
      status
      paymentStatus
      totalCents
      paidTotalCents
    }
  }
`)

/* ── Interface ── */

export interface CustomerResult {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

export interface BarberResult {
  id: string
  fullName: string
  photoUrl: string | null
}

export interface WalkInLite {
  id: string
  status: string
  assignedStaffUser: { id: string; fullName: string } | null
  customer: CustomerResult | null
}

export interface CheckoutRepository {
  getCategories(): Promise<CatalogCategory[]>
  getServices(locationId: string, staffUserId?: string | null): Promise<CatalogService[]>
  getProducts(locationId: string): Promise<CatalogProduct[]>
  getCombos(): Promise<CatalogCombo[]>
  resolveServicePriceForBarber(serviceId: string, locationId: string, staffUserId: string): Promise<number>
  getStockLevels(locationId: string): Promise<StockLevel[]>
  createSale(input: CreateSaleInput): Promise<SaleResult>
  searchCustomers(query: string, limit?: number): Promise<CustomerResult[]>
  findOrCreateCustomer(name: string, email?: string | null, phone?: string | null): Promise<CustomerResult | null>
  findOrCreateMostradorCustomer(): Promise<{ id: string; fullName: string }>
  getBarbers(locationId: string): Promise<BarberResult[]>
  getCustomer(id: string): Promise<CustomerResult | null>
  getWalkIn(walkInId: string, locationId: string): Promise<WalkInLite | null>
}

/* ── Apollo Implementation ── */

interface RawPricingExtra {
  serviceId: string
  name: string
  priceCents: number
  durationMin: number
}

interface RawPricing {
  priceCents: number
  durationMin: number
  extras: RawPricingExtra[]
}

interface RawService {
  id: string
  name: string
  basePriceCents: number
  baseDurationMin: number
  isActive: boolean
  isAddOn: boolean
  imageUrl: string | null
  categoryId: string | null
  pricingFor: RawPricing | null
}

interface RawProduct {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  categoryId: string | null
  isActive: boolean
  variants: { id: string; priceCents: number }[]
}

export class ApolloCheckoutRepository implements CheckoutRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getCategories(): Promise<CatalogCategory[]> {
    const { data } = await this.#client.query<{ catalogCategories: CatalogCategory[] }>({
      query: CATEGORIES_QUERY,
      fetchPolicy: 'cache-first',
    })
    return data!.catalogCategories
  }

  async getServices(locationId: string, staffUserId?: string | null): Promise<CatalogService[]> {
    const { data } = await this.#client.query<{ services: RawService[] }>({
      query: SERVICES_QUERY,
      variables: { locationId, staffUserId: staffUserId ?? null },
      fetchPolicy: 'cache-first',
    })
    return data!.services
      .filter((s: RawService) => s.isActive)
      .map((s: RawService) => ({
        id: s.id,
        name: s.name,
        // Precio/duración resueltos por sucursal (y staff si aplica). Fallback a base
        // si pricingFor no vino por alguna razón (e.g. schema parcial en dev).
        priceCents: s.pricingFor?.priceCents ?? s.basePriceCents,
        durationMin: s.pricingFor?.durationMin ?? s.baseDurationMin,
        isAddOn: s.isAddOn,
        imageUrl: s.imageUrl ?? null,
        categoryId: s.categoryId ?? null,
        extras: s.pricingFor?.extras ?? [],
      }))
  }

  async resolveServicePriceForBarber(serviceId: string, locationId: string, staffUserId: string): Promise<number> {
    const { data } = await this.#client.query<{
      service: { id: string; basePriceCents: number; pricingFor: { priceCents: number } | null } | null
    }>({
      query: RESOLVE_SERVICE_PRICE_QUERY as any,
      variables: { id: serviceId, locationId, staffUserId },
      fetchPolicy: 'cache-first',
    })
    const svc = data?.service
    if (!svc) throw new Error(`Service ${serviceId} not found`)
    return svc.pricingFor?.priceCents ?? svc.basePriceCents
  }

  async getStockLevels(locationId: string): Promise<StockLevel[]> {
    const { data } = await this.#client.query<{ posInventoryLevels: StockLevel[] }>({
      query: POS_INVENTORY_LEVELS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.posInventoryLevels
  }

  async getCombos(): Promise<CatalogCombo[]> {
    const { data } = await this.#client.query<{ catalogCombos: CatalogCombo[] }>({
      query: COMBOS_QUERY,
      fetchPolicy: 'cache-first',
    })
    return data!.catalogCombos
  }

  async getProducts(locationId: string): Promise<CatalogProduct[]> {
    const { data } = await this.#client.query<{ products: RawProduct[] }>({
      query: PRODUCTS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return data!.products
      .filter((p: RawProduct) => p.isActive)
      .map((p: RawProduct) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        priceCents: p.variants[0]?.priceCents ?? 0,
        imageUrl: p.imageUrl,
        categoryId: p.categoryId ?? null,
      }))
  }

  async findOrCreateCustomer(name: string, email?: string | null, phone?: string | null): Promise<CustomerResult | null> {
    if (!email && !phone) return null
    const { data } = await this.#client.mutate<{ findOrCreateCustomer: CustomerResult | null }>({
      mutation: FIND_OR_CREATE_CUSTOMER,
      variables: { name, email: email ?? null, phone: phone ?? null },
    })
    return data!.findOrCreateCustomer ?? null
  }

  async searchCustomers(query: string, limit = 10): Promise<CustomerResult[]> {
    if (query.trim().length < 2) return []
    const { data } = await this.#client.query<{ searchCustomers: CustomerResult[] }>({
      query: SEARCH_CUSTOMERS_QUERY,
      variables: { query: query.trim(), limit },
      fetchPolicy: 'network-only',
    })
    return data!.searchCustomers
  }

  async createSale(input: CreateSaleInput): Promise<SaleResult> {
    const { data } = await this.#client.mutate<{
      createPOSSale: SaleResult
    }>({
      mutation: CREATE_POS_SALE,
      variables: {
        input: {
          locationId: input.locationId,
          registerSessionId: input.registerSessionId,
          customerId: input.customerId,
          staffUserId: input.staffUserId,
          completeWalkInId: input.completeWalkInId ?? null,
          completeAppointmentId: input.completeAppointmentId ?? null,
          items: input.items,
          tipCents: input.tipCents,
          paymentMethod: input.paymentMethod,
        },
      },
    })
    return data!.createPOSSale
  }

  async findOrCreateMostradorCustomer(): Promise<{ id: string; fullName: string }> {
    const { data } = await this.#client.mutate({ mutation: FIND_OR_CREATE_MOSTRADOR_CUSTOMER })
    const result = (data as { findOrCreateMostradorCustomer?: { id: string; fullName: string } } | null)?.findOrCreateMostradorCustomer
    if (!result) throw new Error('Mostrador customer not returned')
    return result
  }

  async getBarbers(locationId: string): Promise<BarberResult[]> {
    const { data } = await this.#client.query({
      query: BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return (data as { barbers: BarberResult[] }).barbers
  }

  async getCustomer(id: string): Promise<CustomerResult | null> {
    const { data } = await this.#client.query({
      query: CUSTOMER_QUERY,
      variables: { id },
      fetchPolicy: 'network-only',
    })
    return (data as { customer: CustomerResult | null }).customer ?? null
  }

  async getWalkIn(walkInId: string, locationId: string): Promise<WalkInLite | null> {
    const { data } = await this.#client.query({
      query: WALKINS_FOR_LOOKUP_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    const list = (data as { walkIns: WalkInLite[] }).walkIns
    return list.find((w) => w.id === walkInId) ?? null
  }
}
