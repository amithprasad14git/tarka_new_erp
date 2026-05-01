// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/jest"],
  testMatch: ["**/*.test.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  clearMocks: true,
  restoreMocks: true,
  // Collect coverage from the full project source tree, not only files imported by tests.
  // This makes uncovered files show up as 0% so coverage reflects the entire codebase.
  collectCoverageFrom: [
    "**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/.next/**",
    "!**/coverage/**",
    "!**/tests/**",
    "!**/playwrighttests/**",
    "!**/*.test.{js,jsx}",
    "!jest.config.js",
    "!babel.config.js",
    "!playwright.config.js",
    "!next.config.js"
  ]
};

