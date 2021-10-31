module.exports = {
  root: true,
  parserOptions: {
    "ecmaVersion": 8,
  },
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    quotes: ["error", "double"],
  },
};
