import test from "ava";

import semanticRelease from "../index.js";
import { createCiEnv, gitCommits, gitHead, gitRepo, gitTagHead } from "./helpers/git.js";

test.serial("core runs a custom plugin stack in dry-run mode without creating a tag", async (t) => {
  const { cwd } = await gitRepo(true);

  await gitCommits(["fix: patch release"], { cwd });

  const result = await semanticRelease(
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

  const result = await semanticRelease(
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

  const result = await semanticRelease(
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
    semanticRelease(
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