import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";

import getConfig from "../lib/get-config.js";

test("core requires an explicit analyzeCommits plugin when no defaults are injected", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const error = await t.throwsAsync(getConfig({ cwd, env: {} }, {}));

  t.is(error.errors.length, 1);
  t.is(error.errors[0].code, "EMISSINGREQUIREDPLUGIN");
  t.regex(error.errors[0].details, /analyzeCommits/);
});

test("core consumes injected default plugins when a wrapper provides them", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-config-"));
  const defaultPlugins = [{ analyzeCommits() {} }];
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
    { repositoryUrl: "https://example.com/semantic-release.git" }
  );

  t.is(options.repositoryUrl, "https://example.com/semantic-release.git");
  t.deepEqual(options.plugins, defaultPlugins);
});