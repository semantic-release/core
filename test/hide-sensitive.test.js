import { format } from "node:url";
import { expect, it } from "vitest";
import { repeat } from "lodash-es";
import hideSensitive from "../lib/hide-sensitive.js";
import { SECRET_MIN_SIZE, SECRET_REPLACEMENT } from "../lib/definitions/constants.js";

it("Replace multiple sensitive environment variable values", (t) => {
  const env = { SOME_PASSWORD: "password", SOME_TOKEN: "secret" };
  expect(hideSensitive(env)(`https://user:${env.SOME_PASSWORD}@host.com?token=${env.SOME_TOKEN}`)).toBe(
    `https://user:${SECRET_REPLACEMENT}@host.com?token=${SECRET_REPLACEMENT}`
  );
});

it("Replace multiple occurrences of sensitive environment variable values", (t) => {
  const env = { secretKey: "secret" };
  expect(hideSensitive(env)(`https://user:${env.secretKey}@host.com?token=${env.secretKey}`)).toBe(
    `https://user:${SECRET_REPLACEMENT}@host.com?token=${SECRET_REPLACEMENT}`
  );
});

it('Replace sensitive environment variable matching specific regex for "private"', (t) => {
  const env = { privateKey: "secret", GOPRIVATE: "host.com" };
  expect(hideSensitive(env)(`https://host.com?token=${env.privateKey}`)).toBe(
    `https://host.com?token=${SECRET_REPLACEMENT}`
  );
});

it("Replace url-encoded environment variable", (t) => {
  const env = { privateKey: "secret " };
  expect(hideSensitive(env)(`https://host.com?token=${encodeURI(env.privateKey)}`)).toBe(
    `https://host.com?token=${SECRET_REPLACEMENT}`
  );
});

it("Escape regexp special characters", (t) => {
  const env = { SOME_CREDENTIALS: "p$^{.+}\\w[a-z]o.*rd" };
  expect(hideSensitive(env)(`https://user:${env.SOME_CREDENTIALS}@host.com`)).toBe(
    `https://user:${SECRET_REPLACEMENT}@host.com`
  );
});

it("Escape regexp special characters in url-encoded environment variable", (t) => {
  const env = { SOME_PASSWORD: "secret password p$^{.+}\\w[a-z]o.*rd)(" };
  expect(hideSensitive(env)(`https://user:${encodeURI(env.SOME_PASSWORD)}@host.com`)).toBe(
    `https://user:${SECRET_REPLACEMENT}@host.com`
  );
});

it('Accept "undefined" input', (t) => {
  expect(hideSensitive({})()).toBe(undefined);
});

it("Return same string if no environment variable has to be replaced", (t) => {
  expect(hideSensitive({})("test")).toBe("test");
});

it("Exclude empty environment variables from the regexp", (t) => {
  const env = { SOME_PASSWORD: "password", SOME_TOKEN: "" };
  expect(hideSensitive(env)(`https://user:${env.SOME_PASSWORD}@host.com?token=`)).toBe(
    `https://user:${SECRET_REPLACEMENT}@host.com?token=`
  );
});

it("Exclude empty environment variables from the regexp if there is only empty ones", (t) => {
  expect(hideSensitive({ SOME_PASSWORD: "", SOME_TOKEN: " \n " })(`https://host.com?token=`)).toBe(
    "https://host.com?token="
  );
});

it("Exclude nonsensitive GOPRIVATE environment variable for Golang projects from the regexp", (t) => {
  const env = { GOPRIVATE: "host.com" };
  expect(hideSensitive(env)(`https://host.com?token=`)).toBe("https://host.com?token=");
});

it("Exclude environment variables with value shorter than SECRET_MIN_SIZE from the regexp", (t) => {
  const SHORT_TOKEN = repeat("a", SECRET_MIN_SIZE - 1);
  const LONG_TOKEN = repeat("b", SECRET_MIN_SIZE);
  const env = { SHORT_TOKEN, LONG_TOKEN };
  expect(hideSensitive(env)(`https://user:${SHORT_TOKEN}@host.com?token=${LONG_TOKEN}`)).toBe(
    `https://user:${SHORT_TOKEN}@host.com?token=${SECRET_REPLACEMENT}`
  );
});

// `lib/get-git-auth-url.js` embeds credentials in the repository URL with `url.format()`, which
// encodes the `auth` field like `encodeURIComponent()` except that `:` separators are kept as is.
// Build the URLs asserted below the same way, so they match what a failing git command prints.
const gitAuthUrl = (auth) => format({ protocol: "https", host: "host.com", pathname: "/owner/repo.git", auth });

for (const character of ["@", "/", "?", "&", "=", "#", " "]) {
  it(`Mask GIT_CREDENTIALS containing "${character}" in a git authentication URL`, (t) => {
    const env = { GIT_CREDENTIALS: `user:abc${character}def-secret` };
    expect(hideSensitive(env)(gitAuthUrl(env.GIT_CREDENTIALS))).toBe(
      `https://${SECRET_REPLACEMENT}@host.com/owner/repo.git`
    );
  });
}

it("Mask GIT_CREDENTIALS containing multiple `:` in a git authentication URL", (t) => {
  const env = { GIT_CREDENTIALS: "user:pa:ss@word-secret" };
  expect(hideSensitive(env)(gitAuthUrl(env.GIT_CREDENTIALS))).toBe(
    `https://${SECRET_REPLACEMENT}@host.com/owner/repo.git`
  );
});

it("Mask GITHUB_TOKEN containing reserved characters in a git authentication URL", (t) => {
  const env = { GITHUB_TOKEN: "ghp_abc@def/secret?x=1&y=2" };
  expect(hideSensitive(env)(gitAuthUrl(`x-access-token:${env.GITHUB_TOKEN}`))).toBe(
    `https://x-access-token:${SECRET_REPLACEMENT}@host.com/owner/repo.git`
  );
});

it("Mask GH_TOKEN containing reserved characters in a git authentication URL", (t) => {
  const env = { GH_TOKEN: "ghp_abc@def-secret" };
  expect(hideSensitive(env)(gitAuthUrl(env.GH_TOKEN))).toBe(`https://${SECRET_REPLACEMENT}@host.com/owner/repo.git`);
});

it("Mask GL_TOKEN containing `:` and reserved characters in a git authentication URL", (t) => {
  const env = { GL_TOKEN: "glpat-abc:def@x-secret" };
  expect(hideSensitive(env)(gitAuthUrl(`gitlab-ci-token:${env.GL_TOKEN}`))).toBe(
    `https://gitlab-ci-token:${SECRET_REPLACEMENT}@host.com/owner/repo.git`
  );
});

it("Mask fully percent-encoded secrets", (t) => {
  const env = { SOME_PASSWORD: "user:pass@word-secret" };
  expect(hideSensitive(env)(`token=${encodeURIComponent(env.SOME_PASSWORD)}`)).toBe(`token=${SECRET_REPLACEMENT}`);
});

it("Mask multiple secrets with reserved characters", (t) => {
  const env = { SOME_PASSWORD: "pass@word", SOME_TOKEN: "token/value" };
  expect(
    hideSensitive(env)(
      `https://user:${encodeURIComponent(env.SOME_PASSWORD)}@host.com?token=${encodeURIComponent(env.SOME_TOKEN)}`
    )
  ).toBe(`https://user:${SECRET_REPLACEMENT}@host.com?token=${SECRET_REPLACEMENT}`);
});

it("Mask encoded credentials in git command output", (t) => {
  const env = { GIT_CREDENTIALS: "user:abc@def-secret" };
  const gitError = `git ls-remote --heads '${gitAuthUrl(env.GIT_CREDENTIALS)}'`;
  expect(hideSensitive(env)(gitError)).toBe(
    `git ls-remote --heads 'https://${SECRET_REPLACEMENT}@host.com/owner/repo.git'`
  );
});

it("Mask multiple occurrences of encoded credentials", (t) => {
  const env = { secretKey: "abc@def-secret" };
  expect(hideSensitive(env)(`url1: ${gitAuthUrl(env.secretKey)} url2: ${gitAuthUrl(env.secretKey)}`)).toBe(
    `url1: https://${SECRET_REPLACEMENT}@host.com/owner/repo.git url2: https://${SECRET_REPLACEMENT}@host.com/owner/repo.git`
  );
});

it("Mask API_KEY values", (t) => {
  const env = { API_KEY: "SUPER-SECRET-VALUE-API_KEY" };
  expect(hideSensitive(env)(`leaked value: ${env.API_KEY}`)).toBe(`leaked value: ${SECRET_REPLACEMENT}`);
});

it("Mask AUTH values", (t) => {
  const env = { BASIC_AUTH: "SUPER-SECRET-VALUE-BASIC_AUTH" };
  expect(hideSensitive(env)(`leaked value: ${env.BASIC_AUTH}`)).toBe(`leaked value: ${SECRET_REPLACEMENT}`);
});

it("Mask WEBHOOK values", (t) => {
  const env = { SLACK_WEBHOOK: "SUPER-SECRET-VALUE-SLACK_WEBHOOK" };
  expect(hideSensitive(env)(`leaked value: ${env.SLACK_WEBHOOK}`)).toBe(`leaked value: ${SECRET_REPLACEMENT}`);
});

it("Mask AWS_ACCESS_KEY_ID values", (t) => {
  const env = { AWS_ACCESS_KEY_ID: "SUPER-SECRET-VALUE-AWS_ACCESS_KEY_ID" };
  expect(hideSensitive(env)(`leaked value: ${env.AWS_ACCESS_KEY_ID}`)).toBe(`leaked value: ${SECRET_REPLACEMENT}`);
});

it("Mask fully percent-encoded API_KEY values", (t) => {
  const env = { API_KEY: "user:pass@word-secret" };
  expect(hideSensitive(env)(`key=${encodeURIComponent(env.API_KEY)}`)).toBe(`key=${SECRET_REPLACEMENT}`);
});

it("Mask common key/auth/webhook env-var names from advisory", (t) => {
  for (const name of [
    "API_KEY",
    "DEPLOY_KEY",
    "SIGNING_KEY",
    "SSH_KEY",
    "ENCRYPTION_KEY",
    "AUTH",
    "BASIC_AUTH",
    "SLACK_WEBHOOK",
    "DOCKER_AUTH",
    "AWS_ACCESS_KEY_ID",
  ]) {
    const secretValue = `SUPER-SECRET-VALUE-${name}`;
    const env = { [name]: secretValue };
    expect(hideSensitive(env)(`leaked value: ${secretValue}`).includes(secretValue)).toBe(false);
  }
});
