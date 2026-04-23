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
      },
    },
  },
  ignoreNoDocuments: false,
}

export default config
