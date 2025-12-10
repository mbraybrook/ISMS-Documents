/**
 * Frontend ESLint Configuration
 * 
 * This configuration enforces code quality standards for the frontend React/TypeScript codebase.
 * AI coding tools (Cursor/Composer) should read this file and .cursorrules to understand linting rules.
 * 
 * Key Rules:
 * - @typescript-eslint/no-explicit-any: Warns against using 'any' type (use proper types or 'unknown')
 * - @typescript-eslint/no-unused-vars: Errors on unused variables (prefix unused with '_')
 * - react-hooks/exhaustive-deps: Warns about missing dependencies in hooks
 * - react-refresh/only-export-components: Ensures Fast Refresh compatibility
 * 
 * See LINTING_STANDARDS.md for comprehensive examples and best practices.
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    /**
     * React Fast Refresh: Only export components from files to ensure Fast Refresh works correctly.
     * Allows constant exports (like configuration objects).
     */
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    /**
     * TypeScript: Discourage use of 'any' type.
     * Use proper types from types/ directory, 'unknown', or type assertions instead.
     * Set to 'warn' to allow gradual migration from existing code.
     */
    '@typescript-eslint/no-explicit-any': 'warn',
    /**
     * TypeScript: Error on unused variables and parameters.
     * Variables/parameters prefixed with '_' are ignored (e.g., _unusedParam, _unusedVar).
     * This allows intentional unused variables while catching accidental ones.
     */
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
}

