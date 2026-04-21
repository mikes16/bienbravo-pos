import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'

export function createPosApolloClient(): ApolloClient {
  const uri = (import.meta.env.VITE_API_URL ?? '') + '/graphql'

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // keyArgs ensure separate cache buckets per filter/search,
          // while repeated identical requests hit a single entry.
          appointments: { keyArgs: ['filter', 'locationId', 'status'] },
          customers: { keyArgs: ['search'] },
          products: { keyArgs: ['filter', 'categoryId'] },
          services: { keyArgs: ['filter', 'categoryId'] },
          catalogCategories: { keyArgs: ['appliesTo'] },
          catalogCombos: { keyArgs: ['activeOnly'] },
          stockLevels: { keyArgs: ['locationId'] },
        },
      },
    },
  })

  return new ApolloClient({
    link: new HttpLink({ uri, credentials: 'include' }),
    cache,
    assumeImmutableResults: true,
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' },
      query: { fetchPolicy: 'cache-first' },
    },
  })
}
