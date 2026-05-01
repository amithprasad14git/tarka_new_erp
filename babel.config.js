// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

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

