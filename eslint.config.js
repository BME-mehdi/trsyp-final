import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/coverage/', '**/.turbo/', '**/.next/', '**/next-env.d.ts', '.agents/', '.claude/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '(^|/)apps(/|$)', message: 'Packages never import from apps.' }] }],
    },
  },
  {
    // Node scripts (plain JavaScript): the globals they use.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    // CLAUDE.md: domain is pure (no I/O) and imports nothing but zod.
    files: ['packages/domain/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!zod$|\\./)', message: 'domain imports only zod and its own files.' }] }],
    },
  },
)
