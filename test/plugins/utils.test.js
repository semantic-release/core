import { expect, it } from "vitest";
import { loadPlugin, parseConfig, validatePlugin, validateStep } from "../../lib/plugins/utils.js";

it("validatePlugin", (t) => {
  const path = "plugin-module";
  const options = { option1: "value1", option2: "value2" };

  expect(validatePlugin(path)).toBe(true);
  expect(validatePlugin({ publish: () => {} })).toBe(true);
  expect(validatePlugin([path])).toBe(true);
  expect(validatePlugin([path, options])).toBe(true);
  expect(validatePlugin([{ publish: () => {} }, options])).toBe(true);
  expect(validatePlugin({ path })).toBe(true);
  expect(validatePlugin({ path, ...options })).toBe(true);
  expect(validatePlugin({ path: { publish: () => {} }, ...options })).toBe(true);

  expect(validatePlugin(1)).toBe(false);
  expect(validatePlugin([])).toBe(false);
  expect(validatePlugin([path, options, {}])).toBe(false);
  expect(validatePlugin([1])).toBe(false);
  expect(validatePlugin([path, 1])).toBe(false);
  expect(validatePlugin({ path: 1 })).toBe(false);
});

it("validateStep: optional plugin configuration", (t) => {
  const type = { multiple: true, required: false };

  // Empty config
  expect(validateStep(type)).toBe(true);
  expect(validateStep(type, [])).toBe(true);

  // Single value definition
  expect(validateStep(type, "plugin-path.js")).toBe(true);
  expect(validateStep(type, () => {})).toBe(true);
  expect(validateStep(type, ["plugin-path.js"])).toBe(true);
  expect(validateStep(type, [() => {}])).toBe(true);
  expect(validateStep(type, {})).toBe(false);
  expect(validateStep(type, [{}])).toBe(false);

  // Array type definition
  expect(validateStep(type, [["plugin-path.js"]])).toBe(true);
  expect(validateStep(type, [["plugin-path.js", { options: "value" }]])).toBe(true);
  expect(validateStep(type, [[() => {}, { options: "value" }]])).toBe(true);
  expect(validateStep(type, [["plugin-path.js", 1]])).toBe(false);

  // Object type definition
  expect(validateStep(type, { path: "plugin-path.js" })).toBe(true);
  expect(validateStep(type, { path: "plugin-path.js", options: "value" })).toBe(true);
  expect(validateStep(type, { path: () => {}, options: "value" })).toBe(true);
  expect(validateStep(type, { path: null })).toBe(false);

  // Considered as an Array of 2 definitions and not as one Array definition in case of a multiple plugin type
  expect(validateStep(type, [() => {}, { options: "value" }])).toBe(false);
  expect(validateStep(type, ["plugin-path.js", { options: "value" }])).toBe(false);

  // Multiple definitions
  expect(
    validateStep(type, [
      "plugin-path.js",
      () => {},
      ["plugin-path.js"],
      ["plugin-path.js", { options: "value" }],
      [() => {}, { options: "value" }],
      { path: "plugin-path.js" },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(true);
  expect(
    validateStep(type, [
      "plugin-path.js",
      () => {},
      ["plugin-path.js"],
      ["plugin-path.js", 1],
      [() => {}, { options: "value" }],
      { path: "plugin-path.js" },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(false);
  expect(
    validateStep(type, [
      "plugin-path.js",
      {},
      ["plugin-path.js"],
      ["plugin-path.js", { options: "value" }],
      [() => {}, { options: "value" }],
      { path: "plugin-path.js" },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(false);
  expect(
    validateStep(type, [
      "plugin-path.js",
      () => {},
      ["plugin-path.js"],
      ["plugin-path.js", { options: "value" }],
      [() => {}, { options: "value" }],
      { path: null },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(false);
});

it("validateStep: required plugin configuration", (t) => {
  const type = { required: true };

  // Empty config
  expect(validateStep(type)).toBe(false);
  expect(validateStep(type, [])).toBe(false);

  // Single value definition
  expect(validateStep(type, "plugin-path.js")).toBe(true);
  expect(validateStep(type, () => {})).toBe(true);
  expect(validateStep(type, ["plugin-path.js"])).toBe(true);
  expect(validateStep(type, [() => {}])).toBe(true);
  expect(validateStep(type, {})).toBe(false);
  expect(validateStep(type, [{}])).toBe(false);

  // Array type definition
  expect(validateStep(type, [["plugin-path.js"]])).toBe(true);
  expect(validateStep(type, [["plugin-path.js", { options: "value" }]])).toBe(true);
  expect(validateStep(type, [[() => {}, { options: "value" }]])).toBe(true);
  expect(validateStep(type, [["plugin-path.js", 1]])).toBe(false);

  // Object type definition
  expect(validateStep(type, { path: "plugin-path.js" })).toBe(true);
  expect(validateStep(type, { path: "plugin-path.js", options: "value" })).toBe(true);
  expect(validateStep(type, { path: () => {}, options: "value" })).toBe(true);
  expect(validateStep(type, { path: null })).toBe(false);

  // Considered as an Array of 2 definitions and not as one Array definition in the case of a multiple plugin type
  expect(validateStep(type, [() => {}, { options: "value" }])).toBe(false);
  expect(validateStep(type, ["plugin-path.js", { options: "value" }])).toBe(false);

  // Multiple definitions
  expect(
    validateStep(type, [
      "plugin-path.js",
      () => {},
      ["plugin-path.js"],
      ["plugin-path.js", { options: "value" }],
      [() => {}, { options: "value" }],
      { path: "plugin-path.js" },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(true);
  expect(
    validateStep(type, [
      "plugin-path.js",
      () => {},
      ["plugin-path.js"],
      ["plugin-path.js", 1],
      [() => {}, { options: "value" }],
      { path: "plugin-path.js" },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(false);
  expect(
    validateStep(type, [
      "plugin-path.js",
      {},
      ["plugin-path.js"],
      ["plugin-path.js", { options: "value" }],
      [() => {}, { options: "value" }],
      { path: "plugin-path.js" },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(false);
  expect(
    validateStep(type, [
      "plugin-path.js",
      () => {},
      ["plugin-path.js"],
      ["plugin-path.js", { options: "value" }],
      [() => {}, { options: "value" }],
      { path: null },
      { path: "plugin-path.js", options: "value" },
      { path: () => {}, options: "value" },
    ])
  ).toBe(false);
});

it("loadPlugin", async (t) => {
  const cwd = process.cwd();
  const func = () => {};

  expect((await import("../fixtures/plugin-noop.cjs")).default, "From cwd").toBe(
    await loadPlugin({ cwd: "./test/fixtures" }, "./plugin-noop.cjs", {})
  );
  expect((await import("../fixtures/plugin-noop.cjs")).default, "From a shareable config context").toBe(
    await loadPlugin({ cwd }, "./plugin-noop.cjs", { "./plugin-noop.cjs": "./test/fixtures" })
  );
  const { ...namedExports } = await import("../fixtures/plugin-esm-named-exports.js");
  const plugin = await loadPlugin({ cwd }, "./plugin-esm-named-exports.js", {
    "./plugin-esm-named-exports.js": "./test/fixtures",
  });

  expect(namedExports, "ESM with named exports").toEqual(plugin);
  expect(func, "Defined as a function").toBe(await loadPlugin({ cwd }, func, {}));
});

it("parseConfig", (t) => {
  const path = "plugin-module";
  const options = { option1: "value1", option2: "value2" };

  expect(parseConfig(path), "String definition").toEqual([path, {}]);
  expect(parseConfig({ path }), "Object definition").toEqual([path, {}]);
  expect(parseConfig({ path, ...options }), "Object definition with options").toEqual([path, options]);
  expect(parseConfig([path]), "Array definition").toEqual([path, {}]);
  expect(parseConfig([path, options]), "Array definition with options").toEqual([path, options]);
});
