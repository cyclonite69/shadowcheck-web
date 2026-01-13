const { FlatCompat } = require('@eslint/eslintrc');
const eslintJs = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: eslintJs.configs.recommended,
  allConfig: eslintJs.configs.all,
});

const ignores = [
  'dist/',
  'build/',
  'node_modules/',
  'coverage/',
  '.nyc_output/',
  '*.log',
  '*.tmp',
  '*.temp',
  'public/assets/',
  'test-*.js',
];

module.exports = [{ ignores }, ...compat.config(require('./.eslintrc.json'))];
