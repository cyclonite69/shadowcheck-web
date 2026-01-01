const fs = require('fs');
const path = require('path');
const { FlatCompat } = require('@eslint/eslintrc');
const eslintJs = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: eslintJs.configs.recommended,
  allConfig: eslintJs.configs.all,
});

const ignoreFile = path.join(__dirname, '.eslintignore');
let ignores = [];
if (fs.existsSync(ignoreFile)) {
  ignores = fs
    .readFileSync(ignoreFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

module.exports = [{ ignores }, ...compat.config(require('./.eslintrc.json'))];
