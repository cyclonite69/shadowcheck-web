/** @type {import('@eslint/eslintrc').FlatCompat} */
const { FlatCompat } = require('@eslint/eslintrc');
/** @type {import('@eslint/js')} */
const eslintJs = require('@eslint/js');
const tsEslintPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

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
];

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  { ignores },
  {
    files: ['**/*.{js,cjs,mjs}'],
  },
  ...compat.config(require('./.eslintrc.json')),
  {
    files: [
      'server/src/services/filterQueryBuilder/**/*.ts',
      'tests/unit/filterQueryBuilder*.ts',
      'tests/unit/radioFilterParity.test.ts',
      'tests/unit/networkFastPathPredicates.test.ts',
      'tests/unit/networkWhereBuilder.test.ts',
      'tests/unit/threatCategoryLevels.test.ts',
      'tests/unit/analyticsQueryBuilders.test.ts',
      'tests/unit/geospatialQueryBuilders.test.ts',
      'tests/unit/observationFilterBuilder.test.ts',
      'tests/unit/builders/*.ts',
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
];
