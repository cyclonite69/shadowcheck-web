/** @type {import('@eslint/eslintrc').FlatCompat} */
const { FlatCompat } = require('@eslint/eslintrc');
/** @type {import('@eslint/js')} */
const eslintJs = require('@eslint/js');
const tsEslintPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: eslintJs.configs.recommended,
  allConfig: eslintJs.configs.all,
});

/** @type {string[]} */
const ignores = [
  'dist/',
  'client/dist/',
  'build/',
  'node_modules/',
  'coverage/',
  '.nyc_output/',
  '*.log',
  '*.tmp',
  '*.temp',
  'client/public/assets/',
  'test-*.js',
  'scratch/**',
];

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  { ignores },
  {
    files: ['**/*.{js,cjs,mjs}'],
  },
  ...compat.config(require('./.eslintrc.json')),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Disable base indent rule for TS files — it mis-fires on TypeScript syntax
      // (type annotations, generics, decorators). Applied via compat-loaded .eslintrc.json.
      indent: 'off',
      // Disable base space-before-function-paren for TS files — misfires on generic
      // function declarations e.g. `function fn<T>(...)`. Applied via compat.
      'space-before-function-paren': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },
  {
    files: ['client/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
