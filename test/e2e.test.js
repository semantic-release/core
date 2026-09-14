import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import { execa } from "execa";
import fsExtra from "fs-extra";

import directCore, { getLogger, resolveConfig, resolveEnvCi } from "../index.js";
import { gitCommits, gitHead, gitRemoteTagHead, gitTagHead } from "./helpers/git.js";
import { gitbox, mockServer, npmRegistry, startE2EEnvironment, stopE2EEnvironment } from "./helpers/e2e-environment.js";

const { readJson, writeJson } = fsExtra;
const owner = "git";
const token = "github-token";
let env;
let npmTestEnv;

const {
  GITHUB_ACTION,
  GITHUB_ACTIONS,
  GITHUB_BASE_REF,
  GITHUB_EVENT_NAME,
  GITHUB_HEAD_REF,
  GITHUB_REF,
  GITHUB_TOKEN,
  ...processEnvWithoutGitHubActionsVariables
} = process.env;

const pluginStack = [
  "@semantic-release/commit-analyzer",
  "@semantic-release/release-notes-generator",
  "@semantic-release/npm",
  "@semantic-release/github",
];

// Config-driven composition
async function executeCore(cwd, options = {}) {
  const stdout = process.stdout;
  const stderr = process.stderr;
  const envCi = resolveEnvCi({ cwd, env });
  const context = { cwd, env, envCi, stdout, stderr, logger: getLogger({ stdout, stderr }) };
  const { options: resolvedOptions, plugins } = await resolveConfig(
    context,
    { ...options, plugins: pluginStack, successCommentCondition: false, failCommentCondition: false },
    { buildPlugins: true }
  );
  return directCore({ context: { ...context, options: resolvedOptions }, plugins });
}

// Direct composition
async function executeCoreWithDirectPlugins(cwd, options = {}) {
  const stdout = process.stdout;
  const stderr = process.stderr;
  const envCi = resolveEnvCi({ cwd, env });
  const context = { cwd, env, envCi, stdout, stderr, logger: getLogger({ stdout, stderr }) };
  const { options: resolvedOptions } = await resolveConfig(context, {
    ...options,
    successCommentCondition: false,
    failCommentCondition: false,
  });
  return directCore({ context: { ...context, options: resolvedOptions }, plugins: pluginStack });
}

// Config-driven composition
async function executeCoreWithReleaseConfig(cwd, options = {}) {
  const stdout = process.stdout;
  const stderr = process.stderr;
  const envCi = resolveEnvCi({ cwd, env });
  const context = { cwd, env, envCi, stdout, stderr, logger: getLogger({ stdout, stderr }) };
  const { options: resolvedOptions, plugins } = await resolveConfig(context, options, { buildPlugins: true });
  return directCore({ context: { ...context, options: resolvedOptions }, plugins });
}

async function mockRepository(repositoryName) {
  return mockServer.mock(
    `/repos/${owner}/${repositoryName}`,
    { headers: [{ name: "Authorization", values: [`token ${token}`] }] },
    {
      body: {
        permissions: { push: true },
        clone_url: gitbox.repositoryUrlFor(repositoryName),
        full_name: `${owner}/${repositoryName}`,
      },
      method: "GET",
    }
  );
}

async function mockRelease(repositoryName, version) {
  return mockServer.mock(
    `/repos/${owner}/${repositoryName}/releases`,
    {
      body: { tag_name: `v${version}`, name: `v${version}` },
      headers: [{ name: "Authorization", values: [`token ${token}`] }],
    },
    { body: { html_url: `release-url/${version}` } }
  );
}

test.before(async () => {
  await startE2EEnvironment();
  const authEnv = npmRegistry.authEnv();
  env = {
    ...processEnvWithoutGitHubActionsVariables,
    ...authEnv,
    CI: "true",
    GIT_CREDENTIALS: gitbox.gitCredential,
    GITHUB_TOKEN: token,
    TRAVIS: "true",
    TRAVIS_BRANCH: "master",
    TRAVIS_PULL_REQUEST: "false",
    GITHUB_API_URL: mockServer.url,
  };
  npmTestEnv = { ...processEnvWithoutGitHubActionsVariables, ...authEnv };
});

test.after.always(async () => {
  await stopE2EEnvironment();
});

test.serial("core composes configured plugins for a real release", async (t) => {
  const packageName = "core-direct-composition";
  const { cwd, repositoryUrl, authUrl } = await gitbox.createRepo(packageName);
  await writeJson(path.resolve(cwd, "package.json"), {
    name: packageName,
    version: "0.0.0-dev",
    repository: { url: repositoryUrl },
    publishConfig: { registry: npmRegistry.url },
  });

  const verifyRepository = await mockRepository(packageName);
  const successRepository = await mockRepository(packageName);
  const createRelease = await mockRelease(packageName, "1.0.0");
  await gitCommits(["feat: compose core plugins directly"], { cwd });

  const result = await executeCore(cwd, { branches: ["master"] });
  const head = await gitHead({ cwd });

  t.is(result.nextRelease.type, "minor");
  t.is(result.nextRelease.version, "1.0.0");
  t.regex(result.nextRelease.notes, /compose core plugins directly/);
  t.is((await readJson(path.resolve(cwd, "package.json"))).version, "1.0.0");
  t.is(await gitTagHead("v1.0.0", { cwd }), head);
  t.is(await gitRemoteTagHead(authUrl, "v1.0.0", { cwd }), head);
  t.is((await npmView(packageName, npmTestEnv))["dist-tags"].latest, "1.0.0");
  await mockServer.verify(verifyRepository);
  await mockServer.verify(successRepository);
  await mockServer.verify(createRelease);

  const verifyRepositoryAgain = await mockRepository(packageName);
  const successRepositoryAgain = await mockRepository(packageName);
  const createPatchRelease = await mockRelease(packageName, "1.0.1");
  await gitCommits(["fix: patch the composed release"], { cwd });

  const patchResult = await executeCore(cwd, { branches: ["master"] });
  const patchHead = await gitHead({ cwd });

  t.is(patchResult.nextRelease.type, "patch");
  t.is(patchResult.nextRelease.version, "1.0.1");
  t.is((await readJson(path.resolve(cwd, "package.json"))).version, "1.0.1");
  t.is(await gitTagHead("v1.0.1", { cwd }), patchHead);
  t.is(await gitRemoteTagHead(authUrl, "v1.0.1", { cwd }), patchHead);
  t.is((await npmView(packageName, npmTestEnv))["dist-tags"].latest, "1.0.1");
  await mockServer.verify(verifyRepositoryAgain);
  await mockServer.verify(successRepositoryAgain);
  await mockServer.verify(createPatchRelease);
});

test.serial("core composes configured plugins in dry-run mode without publishing", async (t) => {
  const packageName = "core-direct-composition-dry-run";
  const { cwd, repositoryUrl, authUrl } = await gitbox.createRepo(packageName);
  await writeJson(path.resolve(cwd, "package.json"), {
    name: packageName,
    version: "0.0.0-dev",
    repository: { url: repositoryUrl },
    publishConfig: { registry: npmRegistry.url },
  });

  const verifyRepository = await mockRepository(packageName);
  await gitCommits(["feat: generate dry-run notes"], { cwd });

  const result = await executeCore(cwd, { branches: ["master"], dryRun: true });

  t.is(result.nextRelease.type, "minor");
  t.is(result.nextRelease.version, "1.0.0");
  t.regex(result.nextRelease.notes, /generate dry-run notes/);
  t.is((await readJson(path.resolve(cwd, "package.json"))).version, "0.0.0-dev");
  await t.throwsAsync(gitTagHead("v1.0.0", { cwd }));
  t.is(await gitRemoteTagHead(authUrl, "v1.0.0", { cwd }), undefined);
  await mockServer.verify(verifyRepository);
  await t.throwsAsync(npmView(packageName, npmTestEnv));
});

test.serial("core composes directly supplied plugins in dry-run mode", async (t) => {
  const packageName = "core-direct-plugin-composition";
  const { cwd, repositoryUrl, authUrl } = await gitbox.createRepo(packageName);
  await writeJson(path.resolve(cwd, "package.json"), {
    name: packageName,
    version: "0.0.0-dev",
    repository: { url: repositoryUrl },
    publishConfig: { registry: npmRegistry.url },
  });

  const verifyRepository = await mockRepository(packageName);
  await gitCommits(["feat: compose plugins directly"], { cwd });

  const result = await executeCoreWithDirectPlugins(cwd, { branches: ["master"], dryRun: true });

  t.is(result.nextRelease.type, "minor");
  t.is(result.nextRelease.version, "1.0.0");
  t.regex(result.nextRelease.notes, /compose plugins directly/);
  t.is((await readJson(path.resolve(cwd, "package.json"))).version, "0.0.0-dev");
  await t.throwsAsync(gitTagHead("v1.0.0", { cwd }));
  t.is(await gitRemoteTagHead(authUrl, "v1.0.0", { cwd }), undefined);
  await mockServer.verify(verifyRepository);
  await t.throwsAsync(npmView(packageName, npmTestEnv));
});

test.serial("core composes plugins configured in .releaserc", async (t) => {
  const packageName = "core-release-config-composition";
  const { cwd, repositoryUrl, authUrl } = await gitbox.createRepo(packageName);
  await writeJson(path.resolve(cwd, "package.json"), {
    name: packageName,
    version: "0.0.0-dev",
    repository: { url: repositoryUrl },
    publishConfig: { registry: npmRegistry.url },
  });
  await writeJson(path.resolve(cwd, ".releaserc"), {
    branches: ["master"],
    tagFormat: "release-${version}",
    plugins: [
      ["@semantic-release/commit-analyzer", { releaseRules: [{ type: "docs", release: "patch" }] }],
      ["@semantic-release/release-notes-generator"],
      ["@semantic-release/npm", { npmPublish: false }],
      ["@semantic-release/github", { successCommentCondition: false, failCommentCondition: false }],
    ],
  });

  const verifyRepository = await mockRepository(packageName);
  await gitCommits(["docs: configure release through releaserc"], { cwd });

  const result = await executeCoreWithReleaseConfig(cwd, { dryRun: true });

  t.is(result.nextRelease.type, "patch");
  t.is(result.nextRelease.version, "1.0.0");
  t.regex(result.nextRelease.notes, /# 1\.0\.0/);
  t.is(result.nextRelease.gitTag, "release-1.0.0");
  t.is((await readJson(path.resolve(cwd, "package.json"))).version, "0.0.0-dev");
  await t.throwsAsync(gitTagHead("release-1.0.0", { cwd }));
  t.is(await gitRemoteTagHead(authUrl, "release-1.0.0", { cwd }), undefined);
  await mockServer.verify(verifyRepository);
  await t.throwsAsync(npmView(packageName, npmTestEnv));
});

test.serial("core wrapper package applies baseConfig and consumer .releaserc overrides", async (t) => {
  const packageName = "core-wrapper-consumer";
  const { cwd, repositoryUrl, authUrl } = await gitbox.createRepo(packageName);
  const packageRoot = path.resolve(".");
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "semantic-release-core-wrapper-"));
  const wrapperPackageDirectory = path.join(fixtureRoot, "wrapper-package");
  const wrapperPackDirectory = path.join(fixtureRoot, "wrapper-pack");
  await mkdir(wrapperPackageDirectory, { recursive: true });
  await mkdir(wrapperPackDirectory, { recursive: true });

  const packedFiles = (
    await execa("npm", ["pack", packageRoot, "--pack-destination", fixtureRoot, "--json"], {
      cwd: packageRoot,
    })
  ).stdout;
  const coreTarball = path.join(fixtureRoot, JSON.parse(packedFiles).at(-1).filename);

  await writeJson(path.join(wrapperPackageDirectory, "package.json"), {
    name: "core-test-wrapper",
    version: "1.0.0",
    type: "module",
    files: ["index.js", "cli.js"],
    bin: { "core-test-wrapper": "cli.js" },
    dependencies: {
      "@semantic-release/commit-analyzer": "^13.0.1",
      "@semantic-release/release-notes-generator": "^14.1.1",
    },
    peerDependencies: { "@semantic-release/core": "*" },
  });
  await writeFile(
    path.join(wrapperPackageDirectory, "index.js"),
    `import semanticRelease, { getLogger, resolveConfig, resolveEnvCi } from "@semantic-release/core";

export default async function run({ cwd = process.cwd(), env = process.env } = {}) {
  const stdout = process.stdout;
  const stderr = process.stderr;
  const envCi = resolveEnvCi({ cwd, env });
  const context = { cwd, env, envCi, stdout, stderr, logger: getLogger({ stdout, stderr }) };
  const { options, plugins } = await resolveConfig(context, {}, {
    buildPlugins: true,
    baseConfig: {
      branches: ["master"],
      tagFormat: "wrapper-v\${version}",
      plugins: ["@semantic-release/commit-analyzer", "@semantic-release/release-notes-generator"],
    },
  });
  return semanticRelease({ context: { ...context, options }, plugins });
}
`,
    "utf8"
  );
  await writeFile(
    path.join(wrapperPackageDirectory, "cli.js"),
    `#!/usr/bin/env node
import run from "./index.js";

const result = await run({ env: process.env });
console.log(JSON.stringify({ version: result.nextRelease.version, type: result.nextRelease.type, tag: result.nextRelease.gitTag }));
`,
    "utf8"
  );

  await execa("npm", ["pack", "--pack-destination", wrapperPackDirectory, "--json"], { cwd: wrapperPackageDirectory });
  const wrapperPackOutput = await execa("npm", ["pack", "--pack-destination", wrapperPackDirectory, "--json"], {
    cwd: wrapperPackageDirectory,
  });
  const wrapperTarball = path.join(wrapperPackDirectory, JSON.parse(wrapperPackOutput.stdout).at(-1).filename);
  await writeJson(path.resolve(cwd, "package.json"), {
    name: packageName,
    version: "0.0.0-dev",
    private: true,
    repository: { url: repositoryUrl },
    dependencies: {
      "@semantic-release/commit-analyzer": "^13.0.1",
      "@semantic-release/core": coreTarball,
      "@semantic-release/release-notes-generator": "^14.1.1",
    },
  });
  await execa("npm", ["install", coreTarball, wrapperTarball, "--ignore-scripts", "--no-package-lock"], { cwd });
  await writeJson(path.resolve(cwd, ".releaserc"), {
    tagFormat: "consumer-v${version}",
    analyzeCommits: { releaseRules: [{ type: "docs", release: "patch" }] },
  });
  await gitCommits(["docs: configure wrapper release"], { cwd });

  const { stdout } = await execa("npx", ["--no-install", "core-test-wrapper"], {
    cwd,
    env: { ...env, GITHUB_API_URL: undefined },
    extendEnv: false,
  });
  const release = JSON.parse(stdout.trim().split("\n").at(-1));
  const head = await gitHead({ cwd });

  t.is(release.type, "patch");
  t.is(release.version, "1.0.0");
  t.is(release.tag, "consumer-v1.0.0");
  t.is(await gitTagHead("consumer-v1.0.0", { cwd }), head);
  t.is(await gitRemoteTagHead(authUrl, "consumer-v1.0.0", { cwd }), head);
});

async function npmView(packageName, environment) {
  return JSON.parse((await execa("npm", ["view", packageName, "--json"], { env: environment })).stdout);
}
