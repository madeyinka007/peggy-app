import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.nx', 'apps/admin/out'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Constitution P-03 (NON-NEGOTIABLE, SC-005): only the Cloudinary
      // provider adapter may import the SDK. Core depends on the
      // StorageProvider port. T056.
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'cloudinary',
          message: 'Constitution P-03: import the Cloudinary SDK only in packages/storage/src/cloudinary-provider.ts; depend on the StorageProvider port everywhere else.',
          allowTypeImports: false,
        }],
      }],
    },
  },
  // Constitution P-04 (NON-NEGOTIABLE): the admin SPA is a pure API consumer.
  // No server-only modules in apps/admin — runtime fetch + better-auth client only.
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@peggy/db', message: 'Constitution P-04: apps/admin is a pure API consumer — use lib/api-client.ts instead.' },
          { name: '@peggy/auth', message: 'Constitution P-04: apps/admin is a pure API consumer — use lib/api-client.ts + better-auth/react instead.' },
          { name: '@peggy/storage', message: 'Constitution P-04: apps/admin is a pure API consumer — use lib/api-client.ts instead.' },
          { name: '@peggy/http', message: 'Constitution P-04: apps/admin is a pure API consumer — use lib/api-client.ts instead.' },
          { name: 'express', message: 'Constitution P-04: no server framework in apps/admin.' },
          { name: 'serverless-http', message: 'Constitution P-04: no server adapter in apps/admin.' },
          { name: 'drizzle-orm', message: 'Constitution P-04: no DB access in apps/admin.' },
        ],
        patterns: [{
          group: ['better-auth', 'better-auth/*', '!better-auth/react', '!better-auth/client'],
          message: 'Constitution P-04/AuthPort: apps/admin may only use the better-auth client (better-auth/react or better-auth/client) — never the server package.',
        }],
      }],
    },
  },
  {
    files: ['packages/storage/src/cloudinary-provider.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
