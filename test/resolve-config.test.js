import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, onTestFinished } from "vitest";

import resolveConfig from "../lib/resolve-config.js";

it("core uses plugins passed via options", async (t) => {
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
  const runtimePlugins = [{ analyzeCommits() {} }];

  onTestFinished(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options } = await resolveConfig(
    { cwd, env: {}, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: runtimePlugins }
  );

  expect(options.repositoryUrl).toBe("https://example.com/semantic-release.git");
  expect(options.plugins).toEqual(runtimePlugins);
});

it("core ignores legacy defaultPlugins context argument", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const defaultPlugins = [{ analyzeCommits() {} }];
  const runtimePlugins = [{ analyzeCommits() {} }];
  const logger = {
    success() {},
    log() {},
    warn() {},
    error() {},
    scope() {
      return this;
    },
  };
  onTestFinished(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options } = await resolveConfig(
    { cwd, env: {}, defaultPlugins, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: runtimePlugins }
  );

  expect(options.repositoryUrl).toBe("https://example.com/semantic-release.git");
  expect(options.plugins).toEqual(runtimePlugins);
  expect(options.plugins).not.toBe(defaultPlugins);
});

it("core does not build plugin pipeline by default", async (t) => {
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

  onTestFinished(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const { options, plugins } = await resolveConfig(
    { cwd, env: {}, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: ["@semantic-release/commit-analyzer"] }
  );

  expect(options.repositoryUrl).toBe("https://example.com/semantic-release.git");
  expect(options.plugins).toEqual(["@semantic-release/commit-analyzer"]);
  expect(plugins).toBe(undefined);
});

it("core merges baseConfig object before discovered config and runtime options", async (t) => {
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

  onTestFinished(async () => {
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

  expect(options.repositoryUrl).toBe("https://example.com/override.git");
  expect(options.plugins).toEqual(["@semantic-release/commit-analyzer", "@semantic-release/release-notes-generator"]);
});

it("core loads baseConfig from file path", async (t) => {
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

  onTestFinished(async () => {
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

  expect(options.plugins).toEqual(["@semantic-release/commit-analyzer", "@semantic-release/github"]);
});
