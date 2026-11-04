import { existsSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import getError from "./helpers/get-error.js";
import { temporaryDirectory } from "tempy";
import {
  addNote,
  fetch,
  fetchNotes,
  getBranches,
  getGitHead,
  getTagHead,
  getTags,
  getTagsNotes,
  isBranchUpToDate,
  isGitRepo,
  isRefExists,
  push,
  repoUrl,
  tag,
  verifyTagName,
} from "../lib/git.js";
import {
  gitAddConfig,
  gitAddNote,
  gitCheckout,
  gitCommits,
  gitCommitTag,
  gitDetachedHead,
  gitDetachedHeadFromBranch,
  gitFetch,
  gitGetCommits,
  gitGetNote,
  gitPush,
  gitRemoteTagHead,
  gitRepo,
  gitShallowClone,
  gitTagVersion,
  initGit,
} from "./helpers/git-utils.js";

it("Get the last commit sha", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First"], { cwd });

  const result = await getGitHead({ cwd });

  expect(result).toBe(commits[0].hash);
});

it("Throw error if the last commit sha cannot be found", async (t) => {
  const { cwd } = await gitRepo();

  await getError(getGitHead({ cwd }));
});

it("Unshallow and fetch repository", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();
  await gitCommits(["First", "Second"], { cwd });
  cwd = await gitShallowClone(repositoryUrl);

  expect((await gitGetCommits(undefined, { cwd })).length).toBe(1);

  await fetch(repositoryUrl, "master", "master", { cwd });

  expect((await gitGetCommits(undefined, { cwd })).length).toBe(2);
});

it("Do not throw error when unshallow a complete repository", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  await gitCommits(["First"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  await gitCheckout("second-branch", true, { cwd });
  await gitCommits(["Second"], { cwd });
  await gitPush(repositoryUrl, "second-branch", { cwd });

  await fetch(repositoryUrl, "master", "master", { cwd });
  await fetch(repositoryUrl, "second-branch", "master", { cwd });
});

it("Fetch all tags on a detached head repository", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();

  await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });
  await gitCommits(["Second"], { cwd });
  await gitTagVersion("v1.0.1", undefined, { cwd });
  const [commit] = await gitCommits(["Third"], { cwd });
  await gitTagVersion("v1.1.0", undefined, { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  cwd = await gitDetachedHead(repositoryUrl, commit.hash);

  await fetch(repositoryUrl, "master", "master", { cwd });

  expect((await getTags("master", { cwd })).sort()).toEqual(["v1.0.0", "v1.0.1", "v1.1.0"].sort());
});

it("Fetch all tags on a repository with a detached head from branch (CircleCI)", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();

  await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });
  await gitCommits(["Second"], { cwd });
  await gitTagVersion("v1.0.1", undefined, { cwd });
  const [commit] = await gitCommits(["Third"], { cwd });
  await gitTagVersion("v1.1.0", undefined, { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  await gitCheckout("other-branch", true, { cwd });
  await gitPush(repositoryUrl, "other-branch", { cwd });
  await gitCheckout("master", false, { cwd });
  await gitCommits(["Fourth"], { cwd });
  await gitTagVersion("v2.0.0", undefined, { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  cwd = await gitDetachedHeadFromBranch(repositoryUrl, "other-branch", commit.hash);

  await fetch(repositoryUrl, "master", "other-branch", { cwd });
  await fetch(repositoryUrl, "other-branch", "other-branch", { cwd });

  expect((await getTags("other-branch", { cwd })).sort()).toEqual(["v1.0.0", "v1.0.1", "v1.1.0"].sort());
  expect((await getTags("master", { cwd })).sort()).toEqual(["v1.0.0", "v1.0.1", "v1.1.0", "v2.0.0"].sort());
});

it("Fetch all tags on a detached head repository with outdated cached repo (GitLab CI)", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo();

  await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });
  await gitCommits(["Second"], { cwd });
  await gitTagVersion("v1.0.1", undefined, { cwd });
  let [commit] = await gitCommits(["Third"], { cwd });
  await gitTagVersion("v1.1.0", undefined, { cwd });
  await gitPush(repositoryUrl, "master", { cwd });

  const cloneCwd = await gitShallowClone(repositoryUrl);
  await gitFetch(repositoryUrl, { cwd: cloneCwd });
  await gitCheckout(commit.hash, false, { cwd: cloneCwd });

  [commit] = await gitCommits(["Fourth"], { cwd });
  await gitTagVersion("v1.2.0", undefined, { cwd });
  await gitPush(repositoryUrl, "master", { cwd });

  await fetch(repositoryUrl, "master", "master", { cwd: cloneCwd });
  await gitCheckout(commit.hash, false, { cwd: cloneCwd });

  expect((await getTags("master", { cwd: cloneCwd })).sort()).toEqual(["v1.0.0", "v1.0.1", "v1.1.0", "v1.2.0"].sort());
});

it("Verify if a branch exists", async (t) => {
  const { cwd } = await gitRepo();
  await gitCommits(["First"], { cwd });
  await gitCheckout("other-branch", true, { cwd });
  await gitCommits(["Second"], { cwd });

  expect(await isRefExists("master", { cwd })).toBe(true);
  expect(await isRefExists("other-branch", { cwd })).toBe(true);
  expect(await isRefExists("next", { cwd })).toBeFalsy();
});

it("Get all branches", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  await gitCommits(["First"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  await gitCheckout("second-branch", true, { cwd });
  await gitCommits(["Second"], { cwd });
  await gitPush(repositoryUrl, "second-branch", { cwd });
  await gitCheckout("third-branch", true, { cwd });
  await gitCommits(["Third"], { cwd });
  await gitPush(repositoryUrl, "third-branch", { cwd });

  expect((await getBranches(repositoryUrl, { cwd })).sort()).toEqual(
    ["master", "second-branch", "third-branch"].sort()
  );
});

it("Return empty array if there are no branches", async (t) => {
  const { cwd, repositoryUrl } = await initGit(true);
  expect(await getBranches(repositoryUrl, { cwd })).toEqual([]);
});

it("Get the commit sha for a given tag", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });

  expect(await getTagHead("v1.0.0", { cwd })).toBe(commits[0].hash);
});

it("Return git remote repository url from config", async (t) => {
  const { cwd } = await gitRepo();
  await gitAddConfig("remote.origin.url", "git@hostname.com:owner/package.git", { cwd });

  expect(await repoUrl({ cwd })).toBe("git@hostname.com:owner/package.git");
});

it("Return git remote repository url set while cloning", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();
  await gitCommits(["First"], { cwd });
  cwd = await gitShallowClone(repositoryUrl);

  expect(await repoUrl({ cwd })).toBe(repositoryUrl);
});

it("Return falsy if git repository url is not set", async (t) => {
  const { cwd } = await gitRepo();

  expect(await repoUrl({ cwd })).toBeFalsy();
});

it("Add tag on head commit", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["Test commit"], { cwd });

  await tag("tag_name", "HEAD", { cwd });

  await expect(await gitCommitTag(commits[0].hash, { cwd })).toBe("tag_name");
});

it("Push tag to remote repository", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const commits = await gitCommits(["Test commit"], { cwd });

  await tag("tag_name", "HEAD", { cwd });
  await push(repositoryUrl, { cwd });

  expect(await gitRemoteTagHead(repositoryUrl, "tag_name", { cwd })).toBe(commits[0].hash);
});

it("Push tag to remote repository with remote branch ahead", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const commits = await gitCommits(["First"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  const temporaryRepo = await gitShallowClone(repositoryUrl);
  await gitCommits(["Second"], { cwd: temporaryRepo });
  await gitPush("origin", "master", { cwd: temporaryRepo });

  await tag("tag_name", "HEAD", { cwd });
  await push(repositoryUrl, { cwd });

  expect(await gitRemoteTagHead(repositoryUrl, "tag_name", { cwd })).toBe(commits[0].hash);
});

it('Return "true" if in a Git repository', async (t) => {
  const { cwd } = await gitRepo(true);

  expect(await isGitRepo({ cwd })).toBe(true);
});

it("Return falsy if not in a Git repository", async (t) => {
  const cwd = temporaryDirectory();

  expect(await isGitRepo({ cwd })).toBeFalsy();
});

it('Return "true" for valid tag names', async (t) => {
  expect(await verifyTagName("1.0.0")).toBe(true);
  expect(await verifyTagName("v1.0.0")).toBe(true);
  expect(await verifyTagName("tag_name")).toBe(true);
  expect(await verifyTagName("tag/name")).toBe(true);
});

it("Return falsy for invalid tag names", async (t) => {
  expect(await verifyTagName("?1.0.0")).toBeFalsy();
  expect(await verifyTagName("*1.0.0")).toBeFalsy();
  expect(await verifyTagName("[1.0.0]")).toBeFalsy();
  expect(await verifyTagName("1.0.0..")).toBeFalsy();
});

it("Throws error if obtaining the tags fails", async (t) => {
  const cwd = temporaryDirectory();

  await getError(getTags("master", { cwd }));
});

it('Return "true" if repository is up to date', async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  await gitCommits(["First"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });

  expect(await isBranchUpToDate(repositoryUrl, "master", { cwd })).toBe(true);
});

it("Return falsy if repository is not up to date", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  await gitCommits(["First"], { cwd });
  await gitCommits(["Second"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });

  expect(await isBranchUpToDate(repositoryUrl, "master", { cwd })).toBe(true);

  const temporaryRepo = await gitShallowClone(repositoryUrl);
  await gitCommits(["Third"], { cwd: temporaryRepo });
  await gitPush("origin", "master", { cwd: temporaryRepo });

  expect(await isBranchUpToDate(repositoryUrl, "master", { cwd })).toBeFalsy();
});

it("Return falsy if detached head repository is not up to date", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();

  const [commit] = await gitCommits(["First"], { cwd });
  await gitCommits(["Second"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  cwd = await gitDetachedHead(repositoryUrl, commit.hash);
  await fetch(repositoryUrl, "master", "master", { cwd });

  expect(await isBranchUpToDate(repositoryUrl, "master", { cwd })).toBeFalsy();
});

it("Get a commit note", async (t) => {
  const { cwd } = await gitRepo();
  await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });

  await gitAddNote(JSON.stringify({ note: "note" }), "v1.0.0", { cwd });
  const tagsNotes = await getTagsNotes({ cwd });

  expect(tagsNotes.get("v1.0.0")).toEqual({ note: "note" });
});

it("Return undefined if there is no commit note", async (t) => {
  const { cwd } = await gitRepo();
  await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });

  const tagsNotes = await getTagsNotes({ cwd });

  expect(tagsNotes.get("v1.0.0")).toEqual(undefined);
});

it("Return undefined if a commit note is invalid", async (t) => {
  const { cwd } = await gitRepo();
  await gitCommits(["First"], { cwd });
  await gitTagVersion("v1.0.0", undefined, { cwd });

  await gitAddNote("non-json note", "v1.0.0", { cwd });

  const tagsNotes = await getTagsNotes({ cwd });

  expect(tagsNotes.get("v1.0.0")).toEqual(undefined);
});

it("Add a commit note", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First"], { cwd });

  await addNote({ note: "note" }, commits[0].hash, { cwd });

  expect(await gitGetNote(commits[0].hash, { cwd })).toBe('{"note":"note"}');
});

it("Overwrite a commit note", async (t) => {
  const { cwd } = await gitRepo();
  const commits = await gitCommits(["First"], { cwd });

  await addNote({ note: "note" }, commits[0].hash, { cwd });
  await addNote({ note: "note2" }, commits[0].hash, { cwd });

  expect(await gitGetNote(commits[0].hash, { cwd })).toBe('{"note":"note2"}');
});

it("Unshallow and fetch repository with notes", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();
  const commits = await gitCommits(["First", "Second"], { cwd });
  await gitAddNote(JSON.stringify({ note: "note" }), commits[0].hash, { cwd });
  cwd = await gitShallowClone(repositoryUrl);

  await getError(gitGetNote(commits[0].hash, { cwd }));

  await fetch(repositoryUrl, "master", "master", { cwd });
  await fetchNotes(repositoryUrl, { cwd });

  expect(await gitGetNote(commits[0].hash, { cwd })).toBe('{"note":"note"}');
});

it("Fetch all notes on a detached head repository", async (t) => {
  let { cwd, repositoryUrl } = await gitRepo();

  await gitCommits(["First"], { cwd });
  const [commit] = await gitCommits(["Second"], { cwd });
  await gitPush(repositoryUrl, "master", { cwd });
  await gitAddNote(JSON.stringify({ note: "note" }), commit.hash, { cwd });
  cwd = await gitDetachedHead(repositoryUrl, commit.hash);

  await fetch(repositoryUrl, "master", "master", { cwd });
  await fetchNotes(repositoryUrl, { cwd });

  expect(await gitGetNote(commit.hash, { cwd })).toBe('{"note":"note"}');
});

it("Does not execute a `repositoryUrl` injected as an `--upload-pack` git option", async (t) => {
  const { cwd } = await gitRepo();
  await gitCommits(["First"], { cwd });
  const marker = path.join(temporaryDirectory(), "upload-pack-rce");
  // A `repositoryUrl` beginning with `-` would be parsed by git as a
  // command-line option rather than a positional argument. `--upload-pack`
  // lets the injected value run an arbitrary binary when fetching refs.
  const repositoryUrl = `--upload-pack=touch ${marker}`;

  await getError(isBranchUpToDate(repositoryUrl, "master", { cwd }));

  expect(existsSync(marker)).toBe(false);
});

it("Does not execute a `repositoryUrl` injected as a `--receive-pack` git option", async (t) => {
  const { cwd } = await gitRepo(true);
  await gitCommits(["First"], { cwd });
  const marker = path.join(temporaryDirectory(), "receive-pack-rce");
  // `--receive-pack` is the push-side equivalent: it lets the injected value
  // run an arbitrary binary when pushing to the (configured) remote.
  const repositoryUrl = `--receive-pack=touch ${marker}`;

  await getError(push(repositoryUrl, { cwd }));

  expect(existsSync(marker)).toBe(false);
});
