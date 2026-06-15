import test from "ava";
import { stub } from "sinon";
import getCommits from "../lib/get-commits.js";
import { gitCommits, gitDetachedHead, gitRepo } from "./helpers/git-utils.js";

test.beforeEach((t) => {
  t.context.log = stub();
  t.context.error = stub();
  t.context.logger = { log: t.context.log, error: t.context.error };
});

test("Get all commits when there is no last release", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second"], { cwd });

  const result = await getCommits({ cwd, lastRelease: {}, logger: t.context.logger });

  t.is(result.length, 2);
  t.deepEqual(result, commits);
});

test("Get all commits since gitHead (from lastRelease)", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second", "Third"], { cwd });

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[commits.length - 1].hash },
    logger: t.context.logger,
  });

  t.is(result.length, 2);
  t.deepEqual(result, commits.slice(0, 2));
});

test("Get all commits since gitHead (from lastRelease) on a detached head repo", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();
  const commits = await gitCommits(["First", "Second", "Third"], { cwd });
  cwd = await gitDetachedHead(repositoryUrl, commits[1].hash);

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[commits.length - 1].hash },
    logger: t.context.logger,
  });

  t.is(result.length, 1);
  t.is(result[0].hash, commits[1].hash);
  t.is(result[0].message, commits[1].message);
  t.truthy(result[0].committerDate);
  t.truthy(result[0].author.name);
  t.truthy(result[0].committer.name);
});

test("Get all commits between lastRelease.gitHead and a shas", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second", "Third"], { cwd });

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[commits.length - 1].hash },
    nextRelease: { gitHead: commits[1].hash },
    logger: t.context.logger,
  });

  t.is(result.length, 1);
  t.deepEqual(result, commits.slice(1, -1));
});

test("Return empty array if lastRelease.gitHead is the last commit", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second"], { cwd });

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[0].hash },
    logger: t.context.logger,
  });

  t.deepEqual(result, []);
});

test("Return empty array if there is no commits", async (t) => {
  const { cwd } = await gitRepo();

  const result = await getCommits({ cwd, lastRelease: {}, logger: t.context.logger });

  t.deepEqual(result, []);
});
