import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";

import resolveConfig from "../lib/resolve-config.js";

test("core uses plugins passed via options", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const logger = {
    success() {},
    log() {},
    warn() {},
    error() {},
    scope() {
      return this;
    },
  };
  const cliPlugins = [{ analyzeCommits() {} }];

  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options } = await resolveConfig(
    { cwd, env: {}, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: cliPlugins }
  );

  t.is(options.repositoryUrl, "https://example.com/semantic-release.git");
  t.deepEqual(options.plugins, cliPlugins);
});

test("core ignores legacy defaultPlugins context argument", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const defaultPlugins = [{ analyzeCommits() {} }];
  const cliPlugins = [{ analyzeCommits() {} }];
  const logger = {
    success() {},
    log() {},
    warn() {},
    error() {},
    scope() {
      return this;
    },
  };
  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options } = await resolveConfig(
    { cwd, env: {}, defaultPlugins, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: cliPlugins }
  );

  t.is(options.repositoryUrl, "https://example.com/semantic-release.git");
  t.deepEqual(options.plugins, cliPlugins);
  t.not(options.plugins, defaultPlugins);
});

test("core can skip plugin pipeline build when requested", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const logger = {
    success() {},
    log() {},
    warn() {},
    error() {},
    scope() {
      return this;
    },
  };

  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options, plugins } = await resolveConfig(
    { cwd, env: {}, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: ["@semantic-release/commit-analyzer"] },
    { buildPlugins: false }
  );

  t.is(options.repositoryUrl, "https://example.com/semantic-release.git");
  t.deepEqual(options.plugins, ["@semantic-release/commit-analyzer"]);
  t.is(plugins, undefined);
});

test("core merges baseConfig object before discovered config and cli options", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const logger = {
    success() {},
    log() {},
    warn() {},
    error() {},
    scope() {
      return this;
    },
  };

  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options } = await resolveConfig(
    { cwd, env: {}, logger },
    { repositoryUrl: "https://example.com/override.git" },
    {
      baseConfig: {
        repositoryUrl: "https://example.com/base.git",
        plugins: ["@semantic-release/commit-analyzer", "@semantic-release/release-notes-generator"],
      },
    }
  );

  t.is(options.repositoryUrl, "https://example.com/override.git");
  t.deepEqual(options.plugins, ["@semantic-release/commit-analyzer", "@semantic-release/release-notes-generator"]);
});

test("core loads baseConfig from file path", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const logger = {
    success() {},
    log() {},
    warn() {},
    error() {},
    scope() {
      return this;
    },
  };

  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const baseConfigPath = path.join(cwd, "base-config.mjs");
  await writeFile(
    baseConfigPath,
    'export default { plugins: ["@semantic-release/commit-analyzer", "@semantic-release/github"] };\n'
  );

  const { options } = await resolveConfig(
    { cwd, env: {}, logger },
    { repositoryUrl: "https://example.com/semantic-release.git" },
    { baseConfig: baseConfigPath, buildPlugins: false }
  );

  t.deepEqual(options.plugins, ["@semantic-release/commit-analyzer", "@semantic-release/github"]);
});