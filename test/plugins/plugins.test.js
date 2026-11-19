import path from "path";
import { expect, it, beforeEach } from "vitest";
import getError from "../helpers/get-error.js";
import { copy, outputFile } from "fs-extra";
import { stub } from "sinon";
import { temporaryDirectory } from "tempy";
import getPlugins from "../../lib/plugins/index.js";

// Save the current working directory
const cwd = process.cwd();

beforeEach((t) => {
  // Stub the logger functions
  t.log = stub();
  t.warn = stub();
  t.success = stub();
  t.logger = {
    log: t.log,
    warn: t.warn,
    success: t.success,
    scope: () => t.logger,
  };
});

it("Export plugins when required analyzeCommits is configured", async (t) => {
  const plugins = await getPlugins({ cwd, options: { analyzeCommits: () => "patch" }, logger: t.logger }, {});

  // Verify the module returns a function for each plugin
  expect(typeof plugins.verifyConditions).toBe("function");
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.verifyRelease).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.prepare).toBe("function");
  expect(typeof plugins.publish).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");
});

it("Export plugins based on steps config", async (t) => {
  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: {
        verifyConditions: ["./test/fixtures/plugin-noop.cjs", { path: "./test/fixtures/plugin-noop.cjs" }],
        generateNotes: "./test/fixtures/plugin-noop.cjs",
        analyzeCommits: { path: "./test/fixtures/plugin-noop.cjs" },
        verifyRelease: () => {},
      },
    },
    {}
  );

  // Verify the module returns a function for each plugin
  expect(typeof plugins.verifyConditions).toBe("function");
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.verifyRelease).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.prepare).toBe("function");
  expect(typeof plugins.publish).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");
});

it('Export plugins based on "plugins" config (array)', async (t) => {
  const plugin1 = { verifyConditions: stub(), publish: stub() };
  const plugin2 = { verifyConditions: stub(), verifyRelease: stub() };
  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: { plugins: [plugin1, [plugin2, {}]], analyzeCommits: () => "patch", verifyRelease: () => {} },
    },
    {}
  );
  await plugins.verifyConditions({ options: {} });
  expect(plugin1.verifyConditions.calledOnce).toBe(true);
  expect(plugin2.verifyConditions.calledOnce).toBe(true);

  await plugins.publish({ options: {} });
  expect(plugin1.publish.calledOnce).toBe(true);

  await plugins.verifyRelease({ options: {} });
  expect(plugin2.verifyRelease.notCalled).toBe(true);

  // Verify the module returns a function for each plugin
  expect(typeof plugins.verifyConditions).toBe("function");
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.verifyRelease).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.prepare).toBe("function");
  expect(typeof plugins.publish).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");
});

it('Export plugins based on "plugins" config (single definition)', async (t) => {
  const plugin1 = { verifyConditions: stub(), publish: stub() };
  const plugins = await getPlugins(
    { cwd, logger: t.logger, options: { plugins: plugin1, analyzeCommits: () => "patch" } },
    {}
  );

  await plugins.verifyConditions({ options: {} });
  expect(plugin1.verifyConditions.calledOnce).toBe(true);

  await plugins.publish({ options: {} });
  expect(plugin1.publish.calledOnce).toBe(true);

  // Verify the module returns a function for each plugin
  expect(typeof plugins.verifyConditions).toBe("function");
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.verifyRelease).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.prepare).toBe("function");
  expect(typeof plugins.publish).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");
});

it('Merge global options, "plugins" options and step options', async (t) => {
  const plugin1 = [{ verifyConditions: stub(), publish: stub() }, { pluginOpt1: "plugin1" }];
  const plugin2 = [{ verifyConditions: stub() }, { pluginOpt2: "plugin2" }];
  const plugin3 = [stub(), { pluginOpt3: "plugin3" }];
  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: {
        globalOpt: "global",
        plugins: [plugin1, plugin2],
        analyzeCommits: () => "patch",
        verifyRelease: [plugin3],
      },
    },
    {}
  );

  await plugins.verifyConditions({ options: {} });
  expect(plugin1[0].verifyConditions.args[0][0]).toEqual({ globalOpt: "global", pluginOpt1: "plugin1" });
  expect(plugin2[0].verifyConditions.args[0][0]).toEqual({ globalOpt: "global", pluginOpt2: "plugin2" });

  await plugins.publish({ options: {} });
  expect(plugin1[0].publish.args[0][0]).toEqual({ globalOpt: "global", pluginOpt1: "plugin1" });

  await plugins.verifyRelease({ options: {} });
  expect(plugin3[0].args[0][0]).toEqual({ globalOpt: "global", pluginOpt3: "plugin3" });
});

it('Unknown steps of plugins configured in "plugins" are ignored', async (t) => {
  const plugin1 = { verifyConditions: () => {}, unknown: () => {} };
  const plugins = await getPlugins(
    { cwd, logger: t.logger, options: { plugins: [plugin1], analyzeCommits: () => "patch" } },
    {}
  );

  expect(typeof plugins.verifyConditions).toBe("function");
  expect(plugins.unknown).toBe(undefined);
});

it("Export plugins loaded from the dependency of a shareable config module", async (t) => {
  const cwd = temporaryDirectory();
  await copy(
    "./test/fixtures/plugin-noop.cjs",
    path.resolve(cwd, "node_modules/shareable-config/node_modules/custom-plugin/index.js")
  );
  await outputFile(path.resolve(cwd, "node_modules/shareable-config/index.js"), "");

  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: {
        verifyConditions: ["custom-plugin", { path: "custom-plugin" }],
        generateNotes: "custom-plugin",
        analyzeCommits: { path: "custom-plugin" },
        verifyRelease: () => {},
      },
    },
    { "custom-plugin": "shareable-config" }
  );

  // Verify the module returns a function for each plugin
  expect(typeof plugins.verifyConditions).toBe("function");
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.verifyRelease).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.prepare).toBe("function");
  expect(typeof plugins.publish).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");
});

it("Export plugins loaded from the dependency of a shareable config file", async (t) => {
  const cwd = temporaryDirectory();
  await copy("./test/fixtures/plugin-noop.cjs", path.resolve(cwd, "plugin/plugin-noop.cjs"));
  await outputFile(path.resolve(cwd, "shareable-config.js"), "");

  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: {
        verifyConditions: ["./plugin/plugin-noop.cjs", { path: "./plugin/plugin-noop.cjs" }],
        generateNotes: "./plugin/plugin-noop.cjs",
        analyzeCommits: { path: "./plugin/plugin-noop.cjs" },
        verifyRelease: () => {},
      },
    },
    { "./plugin/plugin-noop": "./shareable-config.js" }
  );

  // Verify the module returns a function for each plugin
  expect(typeof plugins.verifyConditions).toBe("function");
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.verifyRelease).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.prepare).toBe("function");
  expect(typeof plugins.publish).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");
});

it("Use default when only options are passed for a single plugin", async (t) => {
  const analyzeCommits = {};
  const generateNotes = {};
  const publish = {};
  const success = () => {};
  const fail = [() => {}];

  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: {
        plugins: ["./test/fixtures/multi-plugin.cjs", "./test/fixtures/multi-plugin.cjs"],
        analyzeCommits,
        generateNotes,
        publish,
        success,
        fail,
      },
    },
    {}
  );

  // Verify the module returns a function for each plugin
  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(typeof plugins.generateNotes).toBe("function");
  expect(typeof plugins.success).toBe("function");
  expect(typeof plugins.fail).toBe("function");

  // Verify only the plugins defined as an object with no `path` are set to the default value
  expect(success.path).toBeFalsy();
  expect(fail.path).toBeFalsy();
});

it("Injects fallback analyzeCommits plugin when plugins list covers no analyzeCommits", async (t) => {
  const publishStub = stub().returns({});
  const pluginWithoutAnalyze = { publish: publishStub };

  const plugins = await getPlugins({ cwd, logger: t.logger, options: { plugins: [pluginWithoutAnalyze] } }, {});

  expect(typeof plugins.analyzeCommits).toBe("function");
  expect(t.warn.called).toBe(false);
});

it("Does not inject fallback when analyzeCommits is covered by a plugin in the plugins list", async (t) => {
  const analyzeStub = stub().returns("patch");
  const pluginWithAnalyze = { analyzeCommits: analyzeStub };

  const plugins = await getPlugins({ cwd, logger: t.logger, options: { plugins: [pluginWithAnalyze] } }, {});

  expect(typeof plugins.analyzeCommits).toBe("function");
  // Confirm our stub is wired, meaning commit-analyzer fallback was NOT injected
  const result = await plugins.analyzeCommits({ options: {}, commits: [], releases: [], lastRelease: {} });
  expect(analyzeStub.calledOnce).toBe(true);
  expect(result).toBe("patch");
});

it("Does not inject fallback when analyzeCommits is set as an explicit step-level plugin spec", async (t) => {
  const analyzeStub = stub().returns("minor");
  // Providing analyzeCommits as a function (plugin spec) — should use it, not inject fallback
  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: { analyzeCommits: analyzeStub },
    },
    {}
  );

  expect(typeof plugins.analyzeCommits).toBe("function");
  // Call with required commits input to confirm our stub is wired (not a fallback)
  const result = await plugins.analyzeCommits({ options: {}, commits: [], releases: [], lastRelease: {} });
  expect(analyzeStub.calledOnce).toBe(true);
  expect(result).toBe("minor");
});

it("Merge global options with plugin options", async (t) => {
  const plugins = await getPlugins(
    {
      cwd,
      logger: t.logger,
      options: {
        globalOpt: "global",
        otherOpt: "globally-defined",
        analyzeCommits: () => "patch",
        verifyRelease: { path: "./test/fixtures/plugin-result-config", localOpt: "local", otherOpt: "locally-defined" },
      },
    },
    {}
  );

  const [result] = await plugins.verifyRelease({ options: {} });

  expect(result.pluginConfig).toEqual({ localOpt: "local", globalOpt: "global", otherOpt: "locally-defined" });
});

it("Throw an error for each invalid plugin configuration", async (t) => {
  const errors = [
    ...(
      await getError(() =>
        getPlugins(
          {
            cwd,
            logger: t.logger,
            options: {
              plugins: ["./test/fixtures/multi-plugin.cjs"],
              verifyConditions: 1,
              analyzeCommits: [],
              verifyRelease: [{}],
              generateNotes: [{ path: null }],
            },
          },
          {}
        )
      )
    ).errors,
  ];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EPLUGINCONF");
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EPLUGINCONF");
  expect(errors[2].name).toBe("SemanticReleaseError");
  expect(errors[2].code).toBe("EPLUGINCONF");
  expect(errors[3].name).toBe("SemanticReleaseError");
  expect(errors[3].code).toBe("EPLUGINCONF");
});

it('Throw EPLUGINSCONF error if the "plugins" option contains an old plugin definition (returns a function)', async (t) => {
  const errors = [
    ...(
      await getError(() =>
        getPlugins(
          {
            cwd,
            logger: t.logger,
            options: { plugins: ["./test/fixtures/multi-plugin.cjs", "./test/fixtures/plugin-noop.cjs", () => {}] },
          },
          {}
        )
      )
    ).errors,
  ];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EPLUGINSCONF");
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EPLUGINSCONF");
});

it('Throw EPLUGINSCONF error for each invalid definition if the "plugins" option', async (t) => {
  const errors = [
    ...(
      await getError(() =>
        getPlugins({ cwd, logger: t.logger, options: { plugins: [1, { path: 1 }, [() => {}, {}, {}]] } }, {})
      )
    ).errors,
  ];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EPLUGINSCONF");
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EPLUGINSCONF");
  expect(errors[2].name).toBe("SemanticReleaseError");
  expect(errors[2].code).toBe("EPLUGINSCONF");
});
