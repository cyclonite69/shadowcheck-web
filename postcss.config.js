const isProduction = process.env.NODE_ENV === 'production';

const plugins = {
  '@tailwindcss/postcss': {},
  autoprefixer: {},
};

if (isProduction) {
  plugins.cssnano = {
    preset: ['default', { discardComments: { removeAll: true } }],
  };
}

module.exports = { plugins };
