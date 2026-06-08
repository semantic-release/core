import test from "ava";
import envCi from "env-ci";

import semanticRelease from "../index.js";
import resolveConfig from "../lib/resolve-config.js";
import getLogger from "../lib/get-logger.js";
import { createCiEnv, gitCommits, gitHead, gitRepo, gitTagHead } from "./helpers/git.js";

async function getCoreExecutionInputs(cliOptions, { cwd, env }) {
  const envCiResult = envCi({ env, cwd });
  const context = {
    cwd,
    env,
    stdout: process.stdout,
    stderr: process.stderr,
    envCi: envCiResult,
    ciBranch: envCiResult.isPr ? envCiResult.prBranch : envCiResult.branch,
    skipRelease: envCiResult.isCi && envCiResult.isPr,
  };
  const logger = getLogger(context);
  context.logger = logger;

  const { plugins, options } = await resolveConfig(context, cliOptions, { buildPlugins: true });
  options.originalRepositoryURL = options.repositoryUrl;
  context.options = options;

  return { context, plugins };
}

async function executeCore(cliOptions, { cwd, env }) {
  const { context, plugins } = await getCoreExecutionInputs(cliOptions, { cwd, env });

  return semanticRelease({ context, plugins, onInit: undefined });
}

test.serial("core runs a custom plugin stack in dry-run mode without creating a tag", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const result = await executeCore(
    {
      branches: ["master"],
      dryRun: true,
      plugins: [
        {
          analyzeCommits: async () => "patch",
          generateNotes: async () => "Release notes",
        },
      ],
    },
    { cwd, env: createCiEnv("master") }
  );

  t.is(result.nextRelease.version, "1.0.0");
  t.is(result.nextRelease.notes, "Release notes");
  await t.throwsAsync(gitTagHead("v1.0.0", { cwd }));
});

test.serial("core calls success hooks for a custom plugin stack on a real release", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  let successContext;

  const result = await executeCore(
    {
      branches: ["master"],
      plugins: [
        {
          analyzeCommits: async () => "patch",
          generateNotes: async () => "Release notes",
          success: async (_, context) => {
            successContext = context;
          },
        },
      ],
    },
    { cwd, env: createCiEnv("master") }
  );

  t.is(result.nextRelease.version, "1.0.0");
  t.is(successContext.nextRelease.version, "1.0.0");
  t.is(successContext.nextRelease.gitHead, await gitHead({ cwd }));
  t.is(successContext.releases.length, 1);
  t.is(successContext.releases[0].version, "1.0.0");
  t.is(await gitTagHead("v1.0.0", { cwd }), successContext.nextRelease.gitHead);
});

test.serial("core returns false when the CI branch is outside the configured release branches", async (t) => {
  const { cwd } = await gitRepo(true);

  const result = await executeCore(
    {
      branches: ["master"],
      plugins: [{ analyzeCommits: async () => "patch" }],
    },
    { cwd, env: createCiEnv("feature/test") }
  );

  t.is(result, false);
});

test.serial("core calls fail hooks for semantic-release errors raised by a custom plugin stack", async (t) => {
  const { cwd } = await gitRepo(true);

  let failContext;

  const error = await t.throwsAsync(
    executeCore(
      {
        branches: ["master"],
        plugins: [
          {
            analyzeCommits: async () => "not-a-release-type",
            fail: async (_, context) => {
              failContext = context;
            },
          },
        ],
      },
      { cwd, env: createCiEnv("master") }
    )
  );

  t.is(error.code, "EANALYZECOMMITSOUTPUT");
  t.is(failContext.errors.length, 1);
  t.is(failContext.errors[0].code, "EANALYZECOMMITSOUTPUT");
});

test.serial("core builds the plugins pipeline when raw plugins are passed directly", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const { context } = await getCoreExecutionInputs(
    {
      branches: ["master"],
      dryRun: true,
      plugins: [{ analyzeCommits: async () => null }],
    },
    { cwd, env: createCiEnv("master") }
  );

  const result = await semanticRelease({
    context,
    plugins: [
      {
        analyzeCommits: async () => "patch",
        generateNotes: async () => "Notes from direct plugins",
      },
    ],
    onInit: undefined,
  });

  t.is(result.nextRelease.version, "1.0.0");
  t.is(result.nextRelease.notes, "Notes from direct plugins");
});

test.serial("core gives precedence to direct plugins over context.options.plugins", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const { context } = await getCoreExecutionInputs(
    {
      branches: ["master"],
      dryRun: true,
      plugins: [{ analyzeCommits: async () => null }],
    },
    { cwd, env: createCiEnv("master") }
  );

  const result = await semanticRelease({
    context,
    plugins: [
      {
        analyzeCommits: async () => "patch",
        generateNotes: async () => "Notes from direct plugins",
      },
    ],
    onInit: undefined,
  });

  t.truthy(result);
  t.is(result.nextRelease.notes, "Notes from direct plugins");
});

test.serial("core throws when plugins input is omitted", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const { context } = await getCoreExecutionInputs(
    {
      branches: ["master"],
      dryRun: true,
      plugins: [
        {
          analyzeCommits: async () => "patch",
          generateNotes: async () => "Notes from options plugins",
        },
      ],
    },
    { cwd, env: createCiEnv("master") }
  );

  const error = await t.throwsAsync(semanticRelease({ context, onInit: undefined }));

  t.is(error.message, "core plugins input must be provided by the caller");
});