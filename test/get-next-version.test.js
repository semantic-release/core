import { expect, it, beforeEach } from "vitest";
import { stub } from "sinon";
import getNextVersion from "../lib/get-next-version.js";

beforeEach((t) => {
  t.log = stub();
  t.logger = { log: t.log };
});

it("Increase version for patch release", (t) => {
  expect(
    getNextVersion({
      branch: { name: "master", type: "release", tags: [{ gitTag: "v1.0.0", version: "1.0.0", channels: [null] }] },
      nextRelease: { type: "patch" },
      lastRelease: { version: "1.0.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("1.0.1");
});

it("Increase version for minor release", (t) => {
  expect(
    getNextVersion({
      branch: { name: "master", type: "release", tags: [{ gitTag: "v1.0.0", version: "1.0.0", channels: [null] }] },
      nextRelease: { type: "minor" },
      lastRelease: { version: "1.0.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("1.1.0");
});

it("Increase version for major release", (t) => {
  expect(
    getNextVersion({
      branch: { name: "master", type: "release", tags: [{ gitTag: "v1.0.0", version: "1.0.0", channels: [null] }] },
      nextRelease: { type: "major" },
      lastRelease: { version: "1.0.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("2.0.0");
});

it("Return 1.0.0 if there is no previous release", (t) => {
  expect(
    getNextVersion({
      branch: { name: "master", type: "release", tags: [] },
      nextRelease: { type: "minor" },
      lastRelease: {},
      logger: t.logger,
    })
  ).toBe("1.0.0");
});

it("Increase version for patch release on prerelease branch", (t) => {
  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [{ gitTag: "v1.0.0", version: "1.0.0", channels: [null] }],
      },
      nextRelease: { type: "patch", channel: "beta" },
      lastRelease: { version: "1.0.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("1.0.1-beta.1");

  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [
          { gitTag: "v1.0.0", version: "1.0.0", channels: [null] },
          { gitTag: "v1.0.1-beta.1", version: "1.0.1-beta.1", channels: ["beta"] },
        ],
      },
      nextRelease: { type: "patch", channel: "beta" },
      lastRelease: { version: "1.0.1-beta.1", channels: ["beta"] },
      logger: t.logger,
    })
  ).toBe("1.0.1-beta.2");

  expect(
    getNextVersion({
      branch: {
        name: "alpha",
        type: "prerelease",
        prerelease: "alpha",
        tags: [{ gitTag: "v1.0.1-beta.1", version: "1.0.1-beta.1", channels: ["beta"] }],
      },
      nextRelease: { type: "patch", channel: "alpha" },
      lastRelease: { version: "1.0.1-beta.1", channels: ["beta"] },
      logger: t.logger,
    })
  ).toBe("1.0.2-alpha.1");
});

it("Increase version for minor release on prerelease branch", (t) => {
  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [{ gitTag: "v1.0.0", version: "1.0.0", channels: [null] }],
      },
      nextRelease: { type: "minor", channel: "beta" },
      lastRelease: { version: "1.0.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("1.1.0-beta.1");

  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [
          { gitTag: "v1.0.0", version: "1.0.0", channels: [null] },
          { gitTag: "v1.1.0-beta.1", version: "1.1.0-beta.1", channels: ["beta"] },
        ],
      },
      nextRelease: { type: "minor", channel: "beta" },
      lastRelease: { version: "1.1.0-beta.1", channels: ["beta"] },
      logger: t.logger,
    })
  ).toBe("1.1.0-beta.2");

  expect(
    getNextVersion({
      branch: {
        name: "alpha",
        type: "prerelease",
        prerelease: "alpha",
        tags: [{ gitTag: "v1.1.0-beta.1", version: "1.1.0-beta.1", channels: ["beta"] }],
      },
      nextRelease: { type: "minor", channel: "alpha" },
      lastRelease: { version: "1.1.0-beta.1", channels: ["beta"] },
      logger: t.logger,
    })
  ).toBe("1.2.0-alpha.1");
});

it("Increase version for major release on prerelease branch", (t) => {
  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [{ gitTag: "v1.0.0", version: "1.0.0", channels: [null] }],
      },
      nextRelease: { type: "major", channel: "beta" },
      lastRelease: { version: "1.0.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("2.0.0-beta.1");

  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [
          { gitTag: "v1.0.0", version: "1.0.0", channels: [null] },
          { gitTag: "v2.0.0-beta.1", version: "2.0.0-beta.1", channels: ["beta"] },
        ],
      },
      nextRelease: { type: "major", channel: "beta" },
      lastRelease: { version: "2.0.0-beta.1", channels: ["beta"] },
      logger: t.logger,
    })
  ).toBe("2.0.0-beta.2");

  expect(
    getNextVersion({
      branch: {
        name: "alpha",
        type: "prerelease",
        prerelease: "alpha",
        tags: [{ gitTag: "v2.0.0-beta.1", version: "2.0.0-beta.1", channels: ["beta"] }],
      },
      nextRelease: { type: "major", channel: "alpha" },
      lastRelease: { version: "2.0.0-beta.1", channels: ["beta"] },
      logger: t.logger,
    })
  ).toBe("3.0.0-alpha.1");
});

it("Return 1.0.0 if there is no previous release on prerelease branch", (t) => {
  expect(
    getNextVersion({
      branch: { name: "beta", type: "prerelease", prerelease: "beta", tags: [] },
      nextRelease: { type: "minor" },
      lastRelease: {},
      logger: t.logger,
    })
  ).toBe("1.0.0-beta.1");
});

it("Increase version for release on prerelease branch after previous commits were merged to release branch", (t) => {
  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [
          { gitTag: "v1.0.0", version: "1.0.0", channels: [null] },
          { gitTag: "v1.1.0", version: "1.1.0", channels: [null] },
          { gitTag: "v1.1.0-beta.1", version: "1.1.0-beta.1", channels: [null, "beta"] },
        ],
      },
      nextRelease: { type: "minor" },
      lastRelease: { version: "1.1.0", channels: [null] },
      logger: t.logger,
    })
  ).toBe("1.2.0-beta.1");
});

it("Increase version for release on prerelease branch based on highest commit type since last regular release", (t) => {
  expect(
    getNextVersion({
      branch: {
        name: "beta",
        type: "prerelease",
        prerelease: "beta",
        tags: [
          { gitTag: "v1.0.0", version: "1.0.0", channels: [null] },
          { gitTag: "v1.1.0-beta.1", version: "1.1.0-beta.1", channels: [null, "beta"] },
        ],
      },
      nextRelease: { type: "major" },
      lastRelease: { version: "v1.1.0-beta.1", channels: [null] },
      logger: t.logger,
    })
  ).toBe("2.0.0-beta.1");
});
