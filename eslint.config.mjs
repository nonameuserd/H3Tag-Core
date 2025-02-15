import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Global ignore patterns to exclude configuration files
const globalIgnorePatterns = {
  ignores: [
    '.eslintcache',
    'tsconfig*.json'
  ]
};

const allRulesOff = {};
for (const rule of Object.keys(eslint.configs.recommended.rules || {})) {
  allRulesOff[rule] = 'off';
}
if (tseslint.configs.recommended.rules) {
  for (const rule of Object.keys(tseslint.configs.recommended.rules)) {
    allRulesOff[rule] = 'off';
  }
}

export default [
  globalIgnorePatterns,
  eslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '.nx/cache/**/*.js',
      '**/*.d.ts',
      '**/node_modules/**',
      '**/build/**',
      '**/wasm/pkg/**/*.js',
      '**/packages/core/src/__tests__/blockchain/consensus/pow.test.ts',
      '**/*.json'
    ],
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
      '**/dist/**',
      '**/node_modules/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.cache/**',
      '**/wasm/**/*.js',
      'packages/api/src/app.ts',
      '**/packages/core/src/__tests__/blockchain/consensus/pow.test.ts'
    ],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: [
          './tsconfig.json',
          './packages/*/tsconfig.json'
        ],
        tsconfigRootDir: '.',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'no-undef': 'off',
      'no-case-declarations': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    files: ['wasm/pkg/*.js'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['jest.config.ts'],
    rules: {
      'quotes': 'off'
    }
  },
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off'
    }
  },
  {
    files: ['**/packages/crypto/src/simd.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['**/packages/crypto/src/native/types.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['**/packages/shared/src/utils/config-service.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['**/packages/core/src/wasm/vote-processor.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['**/packages/core/src/__tests__/**/*', '**/*.test.*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off'
    }
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/__tests__/**/*', '**/*.test.*'],
    rules: allRulesOff,
  }
];
