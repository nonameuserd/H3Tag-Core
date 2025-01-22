import eslint from '@eslint/js';
import * as tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    ignores: ['**/dist/**'], // Add this line at the top level
  },
  // Base config for all JavaScript files
  {
    files: ['**/*.js'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: [
      '**/*.ts',
      'src/**/*.test.ts',
      'src/__tests__/**/*.ts',
      'src/__tests__/**/*',
    ],
    ignores: [
      'packages/**/dist/**/*',
      'packages/**/node_modules/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/pkg/**',
      '**/*.d.ts',
      '**/jest.config.ts',
      '**/wasm/**/*.js', // Ignore compiled WebAssembly JS
      '**/types/**/*.js', // Ignore generated type definitions
      '**/build/**',
      '**/lib/**', // Other common output directories
      '**/.next/**',
      '**/.cache/**',
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        // Node.js globals
        process: true,
        Buffer: true,
        console: true,
        exports: true,
        require: true,
        module: true,
        __dirname: true,
        __filename: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        // Browser globals
        window: true,
        fetch: true,
        WebAssembly: true,
        TextEncoder: true,
        TextDecoder: true,
        Response: true,
        Request: true,
        URL: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-case-declarations': 'warn',
      ...tseslint.configs.recommended.rules,
    },
  },
];
