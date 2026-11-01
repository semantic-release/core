import { expect, it, beforeEach } from "vitest";
import { stub } from "sinon";
import getCommits from "../lib/get-commits.js";
import { gitCommits, gitDetachedHead, gitRepo } from "./helpers/git-utils.js";

beforeEach((t) => {
  t.log = stub();
  t.error = stub();
  t.logger = { log: t.log, error: t.error };
});

it("Get all commits when there is no last release", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second"], { cwd });

  const result = await getCommits({ cwd, lastRelease: {}, logger: t.logger });

  expect(result.length).toBe(2);
  expect(result).toEqual(commits);
});

it("Get all commits since gitHead (from lastRelease)", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second", "Third"], { cwd });

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[commits.length - 1].hash },
    logger: t.logger,
  });

  expect(result.length).toBe(2);
  expect(result).toEqual(commits.slice(0, 2));
});

it("Get all commits since gitHead (from lastRelease) on a detached head repo", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();
  const commits = await gitCommits(["First", "Second", "Third"], { cwd });
  cwd = await gitDetachedHead(repositoryUrl, commits[1].hash);

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[commits.length - 1].hash },
    logger: t.logger,
  });

  expect(result.length).toBe(1);
  expect(result[0].hash).toBe(commits[1].hash);
  expect(result[0].message).toBe(commits[1].message);
  expect(result[0].committerDate).toBeTruthy();
  expect(result[0].author.name).toBeTruthy();
  expect(result[0].committer.name).toBeTruthy();
});

it("Get all commits between lastRelease.gitHead and a shas", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second", "Third"], { cwd });

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[commits.length - 1].hash },
    nextRelease: { gitHead: commits[1].hash },
    logger: t.logger,
  });

  expect(result.length).toBe(1);
  expect(result).toEqual(commits.slice(1, -1));
});

it("Return empty array if lastRelease.gitHead is the last commit", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First", "Second"], { cwd });

  const result = await getCommits({
    cwd,
    lastRelease: { gitHead: commits[0].hash },
    logger: t.logger,
  });

  expect(result).toEqual([]);
});

it("Return empty array if there is no commits", async (t) => {
  const { cwd } = await gitRepo();

  const result = await getCommits({ cwd, lastRelease: {}, logger: t.logger });

  expect(result).toEqual([]);
});
