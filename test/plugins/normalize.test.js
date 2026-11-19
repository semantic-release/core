import { expect, it, beforeEach } from "vitest";
import getError from "../helpers/get-error.js";
import { noop } from "lodash-es";
import { stub } from "sinon";
import normalize from "../../lib/plugins/normalize.js";

const cwd = process.cwd();

beforeEach((t) => {
  // Stub the logger functions
  t.log = stub();
  t.error = stub();
  t.success = stub();
  t.stderr = { write: stub() };
  t.logger = {
    log: t.log,
    error: t.error,
    success: t.success,
    scope: () => t.logger,
  };
});

it("Normalize and load plugin from string", async (t) => {
  const plugin = await normalize(
    { cwd, options: {}, logger: t.logger },
    "verifyConditions",
    "./test/fixtures/plugin-noop.cjs",
    {}
  );

  expect(plugin.pluginName).toBe("./test/fixtures/plugin-noop.cjs");
  expect(typeof plugin).toBe("function");
  expect(t.success.args[0]).toEqual(['Loaded plugin "verifyConditions" from "./test/fixtures/plugin-noop.cjs"']);
});

it("Normalize and load plugin from object", async (t) => {
  const plugin = await normalize(
    { cwd, options: {}, logger: t.logger },
    "publish",
    { path: "./test/fixtures/plugin-noop.cjs" },
    {}
  );

  expect(plugin.pluginName).toBe("./test/fixtures/plugin-noop.cjs");
  expect(typeof plugin).toBe("function");
  expect(t.success.args[0]).toEqual(['Loaded plugin "publish" from "./test/fixtures/plugin-noop.cjs"']);
});

it("Normalize and load plugin from a base file path", async (t) => {
  const plugin = await normalize({ cwd, options: {}, logger: t.logger }, "verifyConditions", "./plugin-noop.cjs", {
    "./plugin-noop.cjs": "./test/fixtures",
  });

  expect(plugin.pluginName).toBe("./plugin-noop.cjs");
  expect(typeof plugin).toBe("function");
  expect(t.success.args[0]).toEqual([
    'Loaded plugin "verifyConditions" from "./plugin-noop.cjs" in shareable config "./test/fixtures"',
  ]);
});

it('Wrap plugin in a function that add the "pluginName" to the error"', async (t) => {
  const plugin = await normalize({ cwd, options: {}, logger: t.logger }, "verifyConditions", "./plugin-error", {
    "./plugin-error": "./test/fixtures",
  });

  const error = await getError(plugin({ options: {} }));

  expect(error.pluginName).toBe("./plugin-error");
});

it('Wrap plugin in a function that add the "pluginName" to multiple errors"', async (t) => {
  const plugin = await normalize({ cwd, options: {}, logger: t.logger }, "verifyConditions", "./plugin-errors", {
    "./plugin-errors": "./test/fixtures",
  });

  const errors = [...(await getError(plugin({ options: {} }))).errors];
  for (const error of errors) {
    expect(error.pluginName).toBe("./plugin-errors");
  }
});

it("Normalize and load plugin from function", async (t) => {
  const pluginFunction = () => {};
  const plugin = await normalize({ cwd, options: {}, logger: t.logger }, "", pluginFunction, {});

  expect(plugin.pluginName).toBe("[Function: pluginFunction]");
  expect(typeof plugin).toBe("function");
});

it("Normalize and load plugin that returns multiple functions", async (t) => {
  const plugin = await normalize(
    { cwd, options: {}, logger: t.logger },
    "verifyConditions",
    "./test/fixtures/multi-plugin.cjs",
    {}
  );

  expect(typeof plugin).toBe("function");
  expect(t.success.args[0]).toEqual(['Loaded plugin "verifyConditions" from "./test/fixtures/multi-plugin.cjs"']);
});

it('Wrap "analyzeCommits" plugin in a function that validate the output of the plugin', async (t) => {
  const analyzeCommits = stub().resolves(2);
  const plugin = await normalize(
    { cwd, options: {}, stderr: t.stderr, logger: t.logger },
    "analyzeCommits",
    analyzeCommits,
    {}
  );

  const error = await getError(plugin({ options: {} }));

  expect(error.code).toBe("EANALYZECOMMITSOUTPUT");
  expect(error.name).toBe("SemanticReleaseError");
  expect(error.message).toBeTruthy();
  expect(error.details).toBeTruthy();
  expect(error.details).toMatch(/2/);
});

it('Wrap "generateNotes" plugin in a function that validate the output of the plugin', async (t) => {
  const generateNotes = stub().resolves(2);
  const plugin = await normalize(
    { cwd, options: {}, stderr: t.stderr, logger: t.logger },
    "generateNotes",
    generateNotes,
    {}
  );

  const error = await getError(plugin({ options: {} }));

  expect(error.code).toBe("EGENERATENOTESOUTPUT");
  expect(error.name).toBe("SemanticReleaseError");
  expect(error.message).toBeTruthy();
  expect(error.details).toBeTruthy();
  expect(error.details).toMatch(/2/);
});

it('Wrap "publish" plugin in a function that validate the output of the plugin', async (t) => {
  const publish = stub().resolves(2);
  const plugin = await normalize({ cwd, options: {}, stderr: t.stderr, logger: t.logger }, "publish", publish, {});

  const error = await getError(plugin({ options: {} }));

  expect(error.code).toBe("EPUBLISHOUTPUT");
  expect(error.name).toBe("SemanticReleaseError");
  expect(error.message).toBeTruthy();
  expect(error.details).toBeTruthy();
  expect(error.details).toMatch(/2/);
});

it('Wrap "addChannel" plugin in a function that validate the output of the plugin', async (t) => {
  const addChannel = stub().resolves(2);
  const plugin = await normalize(
    { cwd, options: {}, stderr: t.stderr, logger: t.logger },
    "addChannel",
    addChannel,
    {}
  );

  const error = await getError(plugin({ options: {} }));

  expect(error.code).toBe("EADDCHANNELOUTPUT");
  expect(error.name).toBe("SemanticReleaseError");
  expect(error.message).toBeTruthy();
  expect(error.details).toBeTruthy();
  expect(error.details).toMatch(/2/);
});

it('Plugin is called with "pluginConfig" (with object definition) and input', async (t) => {
  const pluginFunction = stub().resolves();
  const pluginConf = { path: pluginFunction, conf: "confValue" };
  const options = { global: "globalValue" };
  const plugin = await normalize({ cwd, options, logger: t.logger }, "", pluginConf, {});
  await plugin({ options: {}, param: "param" });

  expect(
    pluginFunction.calledWithMatch({ conf: "confValue", global: "globalValue" }, { param: "param", logger: t.logger })
  ).toBe(true);
});

it('Plugin is called with "pluginConfig" (with array definition) and input', async (t) => {
  const pluginFunction = stub().resolves();
  const pluginConf = [pluginFunction, { conf: "confValue" }];
  const options = { global: "globalValue" };
  const plugin = await normalize({ cwd, options, logger: t.logger }, "", pluginConf, {});
  await plugin({ options: {}, param: "param" });

  expect(
    pluginFunction.calledWithMatch({ conf: "confValue", global: "globalValue" }, { param: "param", logger: t.logger })
  ).toBe(true);
});

it('Prevent plugins to modify "pluginConfig"', async (t) => {
  const pluginFunction = stub().callsFake((pluginConfig) => {
    pluginConfig.conf.subConf = "otherConf";
  });
  const pluginConf = { path: pluginFunction, conf: { subConf: "originalConf" } };
  const options = { globalConf: { globalSubConf: "originalGlobalConf" } };
  const plugin = await normalize({ cwd, options, logger: t.logger }, "", pluginConf, {});
  await plugin({ options: {} });

  expect(pluginConf.conf.subConf).toBe("originalConf");
  expect(options.globalConf.globalSubConf).toBe("originalGlobalConf");
});

it("Prevent plugins to modify its input", async (t) => {
  const pluginFunction = stub().callsFake((pluginConfig, options) => {
    options.param.subParam = "otherParam";
  });
  const input = { param: { subParam: "originalSubParam" }, options: {} };
  const plugin = await normalize({ cwd, options: {}, logger: t.logger }, "", pluginFunction, {});
  await plugin(input);

  expect(input.param.subParam).toBe("originalSubParam");
});

it("Return noop if the plugin is not defined", async (t) => {
  const plugin = await normalize({ cwd, options: {}, logger: t.logger });

  expect(plugin).toBe(noop);
});

it('Always pass a defined "pluginConfig" for plugin defined with string', async (t) => {
  // Call the normalize function with the path of a plugin that returns its config
  const plugin = await normalize(
    { cwd, options: {}, logger: t.logger },
    "",
    "./test/fixtures/plugin-result-config",
    {}
  );
  const pluginResult = await plugin({ options: {} });

  expect(pluginResult.pluginConfig).toEqual({});
});

it('Always pass a defined "pluginConfig" for plugin defined with path', async (t) => {
  // Call the normalize function with the path of a plugin that returns its config
  const plugin = await normalize(
    { cwd, options: {}, logger: t.logger },
    "",
    { path: "./test/fixtures/plugin-result-config" },
    {}
  );
  const pluginResult = await plugin({ options: {} });

  expect(pluginResult.pluginConfig).toEqual({});
});

it("Throws an error if the plugin return an object without the expected plugin function", async (t) => {
  const error = await getError(() =>
    normalize({ cwd, options: {}, logger: t.logger }, "nonExistentPlugin", "./test/fixtures/multi-plugin.cjs", {})
  );

  expect(error.code).toBe("EPLUGIN");
  expect(error.name).toBe("SemanticReleaseError");
  expect(error.message).toBeTruthy();
  expect(error.details).toBeTruthy();
});

it("Throws an error if the plugin is not found", async (t) => {
  await getError(
    () => normalize({ cwd, options: {}, logger: t.logger }, "nonExistentPlugin", "non-existing-path", {}),
    {
      message: /Cannot find module 'non-existing-path'/,
      code: "MODULE_NOT_FOUND",
      instanceOf: Error,
    }
  );
});
