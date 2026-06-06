import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";

import getConfig from "../lib/get-config.js";

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

  const { options } = await getConfig(
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

  const { options } = await getConfig(
    { cwd, env: {}, defaultPlugins, logger },
    { repositoryUrl: "https://example.com/semantic-release.git", plugins: cliPlugins }
  );

  t.is(options.repositoryUrl, "https://example.com/semantic-release.git");
  t.deepEqual(options.plugins, cliPlugins);
  t.not(options.plugins, defaultPlugins);
});