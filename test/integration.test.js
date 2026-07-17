import test from "ava";
import envCi from "env-ci";
import { escapeRegExp } from "lodash-es";

import semanticRelease from "../index.js";
import resolveConfig from "../lib/resolve-config.js";
import getLogger from "../lib/get-logger.js";
import { COMMIT_EMAIL, COMMIT_NAME, SECRET_REPLACEMENT } from "../lib/definitions/constants.js";
import { createCiEnv, gitCommits, gitHead, gitRepo, gitTagHead } from "./helpers/git.js";

async function getCoreExecutionInputs(runtimeOptions, { cwd, env, stdout = process.stdout, stderr = process.stderr }) {
  const envCiResult = envCi({ env, cwd });
  const context = {
    cwd,
    env,
    stdout,
    stderr,
    envCi: envCiResult,
    ciBranch: envCiResult.isPr ? envCiResult.prBranch : envCiResult.branch,
    skipRelease: envCiResult.isCi && envCiResult.isPr,
  };
  const logger = getLogger(context);
  context.logger = logger;

  const { plugins, options } = await resolveConfig(context, runtimeOptions, { buildPlugins: true });
  options.originalRepositoryURL = options.repositoryUrl;
  context.options = options;

  return { context, plugins };
}

async function executeCore(runtimeOptions, { cwd, env }) {
  const { context, plugins } = await getCoreExecutionInputs(runtimeOptions, { cwd, env });

  return semanticRelease({ context, plugins, onInit: undefined });
}

async function executeCoreWithInput(runtimeOptions, { cwd, env, stdout, stderr }, semanticReleaseInput = {}) {
  const { context, plugins } = await getCoreExecutionInputs(runtimeOptions, { cwd, env, stdout, stderr });

  return semanticRelease({ context, plugins, onInit: undefined, ...semanticReleaseInput });
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

test.serial("core applies injected formatOutput to dry-run release notes", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const stdoutWrites = [];
  const stdout = {
    write: (value) => {
      stdoutWrites.push(String(value));
      return true;
    },
  };

  const formatOutputCalls = [];
  const result = await executeCoreWithInput(
    {
      branches: ["master"],
      dryRun: true,
      plugins: [
        {
          analyzeCommits: async () => "patch",
          generateNotes: async () => "# Release notes",
        },
      ],
    },
    { cwd, env: createCiEnv("master"), stdout },
    {
      formatOutput: async (text) => {
        formatOutputCalls.push(text);
        return `formatted:${text}`;
      },
    }
  );

  t.is(result.nextRelease.notes, "# Release notes");
  t.deepEqual(formatOutputCalls, ["# Release notes"]);
  t.true(stdoutWrites.some((entry) => entry.includes("formatted:# Release notes")));
});

test.serial("core applies injected formatOutput to semantic-release error details", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const stderrWrites = [];
  const stderr = {
    write: (value) => {
      stderrWrites.push(String(value));
      return true;
    },
  };

  const formatOutputCalls = [];
  const error = await t.throwsAsync(
    executeCoreWithInput(
      {
        branches: ["master"],
        plugins: [{ analyzeCommits: async () => "not-a-release-type" }],
      },
      { cwd, env: createCiEnv("master"), stderr },
      {
        formatOutput: async (text) => {
          formatOutputCalls.push(text);
          return `formatted-error:${text}`;
        },
      }
    )
  );

  t.is(error.code, "EANALYZECOMMITSOUTPUT");
  t.true(formatOutputCalls.length > 0);
  t.true(stderrWrites.some((entry) => entry.includes("formatted-error:")));
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

test.serial("core applies default git env values when caller does not set them", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const env = createCiEnv("master");

  await executeCore(
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
    { cwd, env }
  );

  t.is(env.GIT_AUTHOR_NAME, COMMIT_NAME);
  t.is(env.GIT_AUTHOR_EMAIL, COMMIT_EMAIL);
  t.is(env.GIT_COMMITTER_NAME, COMMIT_NAME);
  t.is(env.GIT_COMMITTER_EMAIL, COMMIT_EMAIL);
  t.is(env.GIT_ASKPASS, "echo");
  t.is(env.GIT_TERMINAL_PROMPT, 0);
});

test.serial("core preserves caller-provided git env values", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const env = {
    ...createCiEnv("master"),
    GIT_AUTHOR_NAME: "custom-author",
    GIT_AUTHOR_EMAIL: "custom-author@example.com",
    GIT_COMMITTER_NAME: "custom-committer",
    GIT_COMMITTER_EMAIL: "custom-committer@example.com",
    GIT_ASKPASS: "custom-askpass",
    GIT_TERMINAL_PROMPT: "1",
  };

  await executeCore(
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
    { cwd, env }
  );

  t.is(env.GIT_AUTHOR_NAME, "custom-author");
  t.is(env.GIT_AUTHOR_EMAIL, "custom-author@example.com");
  t.is(env.GIT_COMMITTER_NAME, "custom-committer");
  t.is(env.GIT_COMMITTER_EMAIL, "custom-committer@example.com");
  t.is(env.GIT_ASKPASS, "custom-askpass");
  t.is(env.GIT_TERMINAL_PROMPT, "1");
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

test.serial("core throws when formatOutput input is not a function", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const { context, plugins } = await getCoreExecutionInputs(
    {
      branches: ["master"],
      dryRun: true,
      plugins: [
        {
          analyzeCommits: async () => "patch",
          generateNotes: async () => "Notes from direct plugins",
        },
      ],
    },
    { cwd, env: createCiEnv("master") }
  );

  const error = await t.throwsAsync(semanticRelease({ context, plugins, onInit: undefined, formatOutput: true }));

  t.is(error.message, "core formatOutput input must be a function when provided");
});

for (const field of ["options", "envCi", "logger", "stdout", "stderr"]) {
  test.serial(`core throws when context.${field} is omitted`, async (t) => {
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

    const invalidContext = { ...context, [field]: undefined };
    const error = await t.throwsAsync(
      semanticRelease({
        context: invalidContext,
        plugins: [
          {
            analyzeCommits: async () => "patch",
            generateNotes: async () => "Notes from direct plugins",
          },
        ],
        onInit: undefined,
      })
    );

    t.is(error.message, `core context.${field} must be provided by the caller`);
  });
}

test.serial("Hide encoded credentials in the logs of a failing git command", async (t) => {
  const { cwd } = await gitRepo(true);
  await gitCommits(["First"], { cwd });

  // `GIT_CREDENTIALS` contains URL reserved characters, so the authenticated repository URL built by
  // `get-git-auth-url.js` contains the credentials percent-encoded (`user:abc%40def%2Fsecret`).
  // The remote points to a closed loopback port, so the first git command using the authenticated URL
  // fails and the failing command is logged.
  const env = { ...createCiEnv("master"), GIT_CREDENTIALS: "user:abc@def/secret" };
  const stdoutChunks = [];
  const stderrChunks = [];
  const stdout = {
    write: (value) => {
      stdoutChunks.push(String(value));
      return true;
    },
  };
  const stderr = {
    write: (value) => {
      stderrChunks.push(String(value));
      return true;
    },
  };

  await t.throwsAsync(
    executeCoreWithInput(
      {
        branches: ["master"],
        repositoryUrl: "http://127.0.0.1:9/owner/repo.git",
        plugins: [
          {
            analyzeCommits: async () => "patch",
            generateNotes: async () => "Release notes",
          },
        ],
      },
      { cwd, env, stdout, stderr }
    )
  );

  const output = stdoutChunks.join("") + stderrChunks.join("");

  // The failing git command was logged with the credentials masked.
  t.regex(output, /127\.0\.0\.1:9/);
  t.regex(output, new RegExp(escapeRegExp(SECRET_REPLACEMENT)));
  t.notRegex(output, new RegExp(escapeRegExp(env.GIT_CREDENTIALS)));
  t.notRegex(output, new RegExp(escapeRegExp("user:abc%40def%2Fsecret")));
  t.notRegex(output, new RegExp(escapeRegExp(encodeURIComponent(env.GIT_CREDENTIALS))));
});
