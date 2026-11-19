import { expect, it } from "vitest";
import getAuthUrl from "../lib/get-git-auth-url.js";
import { gitRepo } from "./helpers/git-utils.js";

const env = { GIT_ASKPASS: "echo", GIT_TERMINAL_PROMPT: 0 };

it('Return the same "git" formatted URL if "gitCredentials" is not defined', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "git@host.null:owner/repo.git" },
    })
  ).toBe("git@host.null:owner/repo.git");
});

it('Return the same "https" formatted URL if "gitCredentials" is not defined', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "https://host.null/owner/repo.git" },
    })
  ).toBe("https://host.null/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is not defined and repositoryUrl is a "git+https" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "git+https://host.null/owner/repo.git" },
    })
  ).toBe("https://host.null/owner/repo.git");
});

it('Do not add trailing ".git" if not present in the origian URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({ cwd, env, branch: { name: "master" }, options: { repositoryUrl: "git@host.null:owner/repo" } })
  ).toBe("git@host.null:owner/repo");
});

it('Handle "https" URL with group and subgroup', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "https://host.null/group/subgroup/owner/repo.git" },
    })
  ).toBe("https://host.null/group/subgroup/owner/repo.git");
});

it('Handle "git" URL with group and subgroup', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "git@host.null:group/subgroup/owner/repo.git" },
    })
  ).toBe("git@host.null:group/subgroup/owner/repo.git");
});

it("Convert shorthand URL", async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "semantic-release/semantic-release" },
    })
  ).toBe("https://github.com/semantic-release/semantic-release.git");
});

it("Convert GitLab shorthand URL", async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env,
      branch: { name: "master" },
      options: { repositoryUrl: "gitlab:semantic-release/semantic-release" },
    })
  ).toBe("https://gitlab.com/semantic-release/semantic-release.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined and repositoryUrl is a "git" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      branch: { name: "master" },
      options: { repositoryUrl: "git@host.null:owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined and repositoryUrl is a "git" URL without user', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      options: { branch: "master", repositoryUrl: "host.null:owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined and repositoryUrl is a "git" URL without user and with a custom port', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      options: { branch: "master", repositoryUrl: "host.null:6666:owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null:6666/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined and repositoryUrl is a "git" URL without user and with a custom port followed by a slash', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      options: { branch: "master", repositoryUrl: "host.null:6666:/owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null:6666/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined and repositoryUrl is a "https" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      branch: { name: "master" },
      options: { repositoryUrl: "https://host.null/owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null/owner/repo.git");
});

it('Return the "http" formatted URL if "gitCredentials" is defined and repositoryUrl is a "http" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      branch: { name: "master" },
      options: { repositoryUrl: "http://host.null/owner/repo.git" },
    })
  ).toBe("http://user:pass@host.null/owner/repo.git");
});

it('Return the "http" formatted URL if "gitCredentials" is defined and repositoryUrl is a "http" URL with custom port', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      options: { branch: "master", repositoryUrl: "http://host.null:8080/owner/repo.git" },
    })
  ).toBe("http://user:pass@host.null:8080/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined and repositoryUrl is a "git+https" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      branch: { name: "master" },
      options: { repositoryUrl: "git+https://host.null/owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null/owner/repo.git");
});

it('Return the "http" formatted URL if "gitCredentials" is defined and repositoryUrl is a "git+http" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      branch: { name: "master" },
      options: { repositoryUrl: "git+http://host.null/owner/repo.git" },
    })
  ).toBe("http://user:pass@host.null/owner/repo.git");
});

it('Return the "http" formatted URL if "gitCredentials" is defined and repositoryUrl is a "ssh" URL', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GIT_CREDENTIALS: "user:pass" },
      options: { branch: "master", repositoryUrl: "ssh://git@host.null:2222/owner/repo.git" },
    })
  ).toBe("https://user:pass@host.null/owner/repo.git");
});

it('Return the "https" formatted URL if "gitCredentials" is defined with "GH_TOKEN"', async (t) => {
  const { cwd } = await gitRepo();

  expect(
    await getAuthUrl({
      cwd,
      env: { ...env, GH_TOKEN: "token" },
      branch: { name: "master" },
      options: { repositoryUrl: "git@host.null:owner/repo.git" },
    })
  ).toBe("https://token@host.null/owner/repo.git");
});
