import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { execa } from "execa";
import pEachSeries from "p-each-series";
import gitLogParser from "git-log-parser";
import getStream from "get-stream";
import { GIT_NOTE_REF } from "../../lib/definitions/constants.js";

/**
 * Initialize git repository.
 * If `withRemote` is `true`, creates a bare repository and initializes it.
 * If `withRemote` is `false`, creates a regular repository and initializes it.
 *
 * @param {boolean} withRemote `true` to create a shallow clone of a bare repository.
 * @returns {Promise<{cwd: string, repositoryUrl: string}>}
 */
export async function initGit(withRemote) {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-git-"));
  const args = withRemote ? ["--bare", "--initial-branch=master"] : ["--initial-branch=master"];

  await execa("git", ["init", ...args], { cwd }).catch(() => {
    const fallbackArgs = withRemote ? ["--bare"] : [];
    return execa("git", ["init", ...fallbackArgs], { cwd });
  });

  const repositoryUrl = pathToFileURL(cwd).href;
  return { cwd, repositoryUrl };
}

/**
 * Create a temporary git repository.
 * If `withRemote` is `true`, creates a shallow clone and returns its path.
 * If `withRemote` is `false`, returns the initialized repository path.
 *
 * @param {boolean} withRemote `true` to create a shallow clone of a bare repository.
 * @param {string} [branch="master"] The branch to initialize.
 * @returns {Promise<{cwd: string, repositoryUrl: string}>}
 */
export async function gitRepo(withRemote, branch = "master") {
  let { cwd, repositoryUrl } = await initGit(withRemote);

  if (withRemote) {
    await initBareRepo(repositoryUrl, branch);
    cwd = await gitShallowClone(repositoryUrl, branch);
  } else {
    await gitCheckout(branch, true, { cwd });
  }

  await execa("git", ["config", "commit.gpgsign", "false"], { cwd });
  await execa("git", ["config", "user.name", "semantic-release test"], { cwd });
  await execa("git", ["config", "user.email", "semantic-release@example.com"], { cwd });

  return { cwd, repositoryUrl };
}

/**
 * Initialize an existing bare repository.
 *
 * @param {string} repositoryUrl The URL of the bare repository.
 * @param {string} [branch="master"] The branch to initialize.
 */
export async function initBareRepo(repositoryUrl, branch = "master") {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-bare-"));
  await execa("git", ["clone", "--no-hardlinks", repositoryUrl, cwd], { cwd });
  await gitCheckout(branch, true, { cwd });
  await gitCommits(["Initial commit"], { cwd });
  await gitPush(repositoryUrl, branch, { cwd });
}

/**
 * Create commits on the current git repository.
 *
 * @param {string[]} messages Commit messages.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 * @returns {Promise<object[]>} The created commits in reverse chronological order.
 */
export async function gitCommits(messages, execaOptions) {
  await pEachSeries(messages, async (message) => {
    await execa("git", ["commit", "-m", message, "--allow-empty", "--no-gpg-sign"], execaOptions);
  });

  return (await gitGetCommits(undefined, execaOptions)).slice(0, messages.length);
}

/**
 * Get the list of parsed commits since a git reference.
 *
 * @param {string} [from] Git reference from which to search commits.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 * @returns {Promise<object[]>} Parsed commits.
 */
export async function gitGetCommits(from, execaOptions = {}) {
  Object.assign(gitLogParser.fields, {
    hash: "H",
    message: "B",
    gitTags: "d",
    committerDate: { key: "ci", type: Date },
  });

  return (
    await getStream.array(
      gitLogParser.parse(
        { _: `${from ? `${from}..` : ""}HEAD` },
        { ...execaOptions, env: { ...process.env, ...execaOptions.env } }
      )
    )
  ).map((commit) => ({
    ...commit,
    message: commit.message.trim(),
    gitTags: commit.gitTags.trim(),
  }));
}

/**
 * Checkout a branch on the current git repository.
 *
 * @param {string} branch Branch name.
 * @param {boolean} create `true` to create the branch, `false` to checkout an existing branch.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 */
export async function gitCheckout(branch, create, execaOptions) {
  await execa("git", create ? ["checkout", "-b", branch] : ["checkout", branch], execaOptions);
}

/**
 * Get the HEAD sha.
 *
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 * @returns {Promise<string>} The head commit sha.
 */
export async function gitHead(execaOptions) {
  return (await execa("git", ["rev-parse", "HEAD"], execaOptions)).stdout;
}

/**
 * Create a tag on the head commit in the current git repository.
 *
 * @param {string} tagName The tag name to create.
 * @param {string} [sha] The commit on which to create the tag.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 */
export async function gitTagVersion(tagName, sha, execaOptions) {
  await execa("git", sha ? ["tag", "-f", tagName, sha] : ["tag", tagName], execaOptions);
}

/**
 * Get the first commit sha referenced by the given tag.
 *
 * @param {string} tagName Tag name.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 * @returns {Promise<string>} The commit sha associated with the tag.
 */
export async function gitTagHead(tagName, execaOptions) {
  return (await execa("git", ["rev-list", "-1", tagName], execaOptions)).stdout;
}

/**
 * Push to the remote repository.
 *
 * @param {string} repositoryUrl The remote repository URL.
 * @param {string} branch The branch to push.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 */
export async function gitPush(repositoryUrl, branch, execaOptions) {
  await execa("git", ["push", "--tags", repositoryUrl, `HEAD:${branch}`], execaOptions);
}

/**
 * Add a note to a Git reference.
 *
 * @param {string} note The note to add.
 * @param {string} ref The ref to add the note to.
 * @param {import("execa").Options} [execaOptions] Options to pass to execa.
 */
export async function gitAddNote(note, ref, execaOptions) {
  await execa("git", ["notes", "--ref", `${GIT_NOTE_REF}-${ref}`, "add", "-m", note, ref], execaOptions);
}

/**
 * Create a shallow clone of a git repository.
 *
 * @param {string} repositoryUrl The repository URL to clone.
 * @param {string} [branch="master"] The branch to clone.
 * @param {number} [depth=1] The number of commits to clone.
 * @returns {Promise<string>} The path to the cloned repository.
 */
export async function gitShallowClone(repositoryUrl, branch = "master", depth = 1) {
  const cwd = await mkdtemp(path.join(tmpdir(), "semantic-release-core-clone-"));

  await execa("git", ["clone", "--no-hardlinks", "--no-tags", "-b", branch, "--depth", `${depth}`, repositoryUrl, cwd], {
    cwd,
  });

  return cwd;
}

/**
 * Build a minimal CI env payload recognized by env-ci.
 *
 * @param {string} branch Branch name for the simulated CI run.
 * @returns {Record<string, string>}
 */
export function createCiEnv(branch) {
  return {
    CI: "true",
    TRAVIS: "true",
    TRAVIS_BRANCH: branch,
    TRAVIS_PULL_REQUEST: "false",
  };
}
