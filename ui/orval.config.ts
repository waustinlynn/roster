import { defineConfig } from 'orval';

export default defineConfig({
  rosterApi: {
    input: {
      target: '../openapi.json',
      fallbackTarget: 'http://localhost:5001/swagger/v1/swagger.json',
    },
    output: {
      target: './src/api/index.ts',
      client: 'react-query',
      mode: 'single',
      override: {
        mutator: {
          path: './src/api/axios.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
