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
  {
    files: ['packages/storage/src/cloudinary-provider.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
