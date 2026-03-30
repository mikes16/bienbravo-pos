import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'

export function createPosApolloClient(): ApolloClient {
  const uri = (import.meta.env.VITE_API_URL ?? '') + '/graphql'

  return new ApolloClient({
    link: new HttpLink({ uri, credentials: 'include' }),
    cache: new InMemoryCache(),
  })
}
