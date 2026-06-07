// Configuration file for project/runtime behavior.

/**
 * Babel transforms for Jest (tests use preset-env; app uses Next.js compiler).
 */

module.exports = function babelConfig(api) {
  const isTest = api.env("test");
  api.cache(true);

  if (isTest) {
    return {
      presets: [
        [
          "@babel/preset-env",
          {
            targets: { node: "current" }
          }
        ]
      ]
    };
  }

  return {
    presets: ["next/babel"]
  };
};

