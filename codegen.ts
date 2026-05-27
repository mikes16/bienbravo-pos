import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'schema.graphql',
  documents: ['src/**/*.{ts,tsx}'],
  generates: {
    'src/core/graphql/generated/': {
      preset: 'client',
      config: {
        useFragmentMasking: false,
        useTypeImports: true,
        // Mapea escalares del API a tipos TS concretos. Sin esto, DateTime
        // queda como `any`, JSON queda como `any`, y la inferencia falla
        // cuando el código consumidor declara tipos más estrictos.
        scalars: {
          DateTime: 'string',
          Date: 'string',
          JSON: 'Record<string, unknown>',
        },
      },
    },
  },
  ignoreNoDocuments: false,
}

export default config
