module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [require("../../scripts/inline-fixture-base.cjs")],
  };
};
