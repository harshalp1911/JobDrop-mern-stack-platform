module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'prettier'
  ],
  plugins: ['react', 'prettier'],
  env: { browser: true, node: true, es6: true },
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' }
};
