import { expect, it, beforeEach, vi } from "vitest";
import getError from "../helpers/get-error.js";
import { union } from "lodash-es";
import semver from "semver";

vi.mock("../../lib/branches/get-tags.js", () => ({ default: vi.fn() }));
vi.mock("../../lib/branches/expand.js", () => ({ default: vi.fn() }));

import getTags from "../../lib/branches/get-tags.js";
import expand from "../../lib/branches/expand.js";
import getBranches from "../../lib/branches/index.js";

const getBranch = (branches, branch) => branches.find(({ name }) => name === branch);
const release = (branches, name, version) => getBranch(branches, name).tags.push({ version });
const merge = (branches, source, target, tag) => {
  getBranch(branches, target).tags = union(
    getBranch(branches, source).tags.filter(({ version }) => !tag || semver.cmp(version, "<=", tag)),
    getBranch(branches, target).tags
  );
};
const remoteBranches = [];
const repositoryUrl = "repositoryUrl";

beforeEach(() => {
  vi.resetAllMocks();
});

it("Enforce ranges with branching release workflow", async (t) => {
  const branches = [
    { name: "1.x", tags: [] },
    { name: "1.0.x", tags: [] },
    { name: "master", tags: [] },
    { name: "next", tags: [] },
    { name: "next-major", tags: [] },
    { name: "beta", prerelease: true, tags: [] },
    { name: "alpha", prerelease: true, tags: [] },
  ];
  const context = { options: { branches } };
  expand.mockResolvedValue(remoteBranches);
  getTags.mockResolvedValue(branches);

  let result = (await getBranches(repositoryUrl, "master", context)).map(({ name, range }) => ({ name, range }));
  expect(getBranch(result, "1.0.x").range, "Cannot release on 1.0.x before a releasing on master").toBe(
    ">=1.0.0 <1.0.0"
  );
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before a releasing on master").toBe(">=1.1.0 <1.0.0");
  expect(getBranch(result, "master").range).toBe(">=1.0.0");
  expect(getBranch(result, "next").range).toBe(">=1.0.0");
  expect(getBranch(result, "next-major").range).toBe(">=1.0.0");

  release(branches, "master", "1.0.0");
  result = (await getBranches("repositoryUrl", "master", context)).map(({ name, range }) => ({ name, range }));
  expect(getBranch(result, "1.0.x").range, "Cannot release on 1.0.x before a releasing on master").toBe(
    ">=1.0.0 <1.0.0"
  );
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before a releasing on master").toBe(">=1.1.0 <1.0.0");
  expect(getBranch(result, "master").range).toBe(">=1.0.0");
  expect(getBranch(result, "next").range).toBe(">=1.0.0");
  expect(getBranch(result, "next-major").range).toBe(">=1.0.0");

  release(branches, "master", "1.0.1");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only > than 1.0.1 on master").toBe(">=1.0.1");
  expect(getBranch(result, "next").range, "Can release only > than 1.0.1 on next").toBe(">=1.0.1");
  expect(getBranch(result, "next-major").range, "Can release only > than 1.0.1 on next-major").toBe(">=1.0.1");

  merge(branches, "master", "next");
  merge(branches, "master", "next-major");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only > than 1.0.1 on master").toBe(">=1.0.1");
  expect(getBranch(result, "next").range, "Can release only > than 1.0.1 on next").toBe(">=1.0.1");
  expect(getBranch(result, "next-major").range, "Can release only > than 1.0.1 on next-major").toBe(">=1.0.1");

  release(branches, "next", "1.1.0");
  release(branches, "next", "1.1.1");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only patch, > than 1.0.1 on master").toBe(">=1.0.1 <1.1.0");
  expect(getBranch(result, "next").range, "Can release only > than 1.1.1 on next").toBe(">=1.1.1");
  expect(getBranch(result, "next-major").range, "Can release > than 1.1.1 on next-major").toBe(">=1.1.1");

  release(branches, "next-major", "2.0.0");
  release(branches, "next-major", "2.0.1");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only patch, > than 1.0.1 on master").toBe(">=1.0.1 <1.1.0");
  expect(getBranch(result, "next").range, "Can release only patch or minor, > than 1.1.0 on next").toBe(
    ">=1.1.1 <2.0.0"
  );
  expect(getBranch(result, "next-major").range, "Can release any version, > than 2.0.1 on next-major").toBe(">=2.0.1");

  merge(branches, "next-major", "beta");
  release(branches, "beta", "3.0.0-beta.1");
  merge(branches, "beta", "alpha");
  release(branches, "alpha", "4.0.0-alpha.1");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "next-major").range, "Can release any version, > than 2.0.1 on next-major").toBe(">=2.0.1");

  merge(branches, "master", "1.0.x");
  merge(branches, "master", "1.x");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only patch, > than 1.0.1 on master").toBe(">=1.0.1 <1.1.0");
  expect(getBranch(result, "1.0.x").range, "Cannot release on 1.0.x before >= 1.1.0 is released on master").toBe(
    ">=1.0.1 <1.0.1"
  );
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before >= 1.2.0 is released on master").toBe(
    ">=1.1.0 <1.0.1"
  );

  release(branches, "master", "1.0.2");
  release(branches, "master", "1.0.3");
  release(branches, "master", "1.0.4");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only patch, > than 1.0.4 on master").toBe(">=1.0.4 <1.1.0");
  expect(getBranch(result, "1.0.x").range, "Cannot release on 1.0.x before >= 1.1.0 is released on master").toBe(
    ">=1.0.1 <1.0.2"
  );
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before >= 1.2.0 is released on master").toBe(
    ">=1.1.0 <1.0.2"
  );

  merge(branches, "next", "master");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));

  expect(getBranch(result, "master").range, "Can release only > than 1.1.1 on master").toBe(">=1.1.1");
  expect(getBranch(result, "next").range, "Can release only patch or minor, > than 1.1.1 on next").toBe(
    ">=1.1.1 <2.0.0"
  );
  expect(getBranch(result, "next-major").range, "Can release any version, > than 2.0.1 on next-major").toBe(">=2.0.1");
  expect(getBranch(result, "1.0.x").range, "Cannot release on 1.0.x before 1.0.x version from master are merged").toBe(
    ">=1.0.1 <1.0.2"
  );
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before >= 2.0.0 is released on master").toBe(
    ">=1.1.0 <1.0.2"
  );

  merge(branches, "master", "1.0.x", "1.0.4");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only > than 1.1.1 on master").toBe(">=1.1.1");
  expect(getBranch(result, "1.0.x").range, "Can release on 1.0.x only within range").toBe(">=1.0.4 <1.1.0");
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before >= 2.0.0 is released on master").toBe(
    ">=1.1.0 <1.1.0"
  );

  merge(branches, "master", "1.x");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only > than 1.1.1 on master").toBe(">=1.1.1");
  expect(getBranch(result, "1.0.x").range, "Can release on 1.0.x only within range").toBe(">=1.0.4 <1.1.0");
  expect(getBranch(result, "1.x").range, "Cannot release on 1.x before >= 2.0.0 is released on master").toBe(
    ">=1.1.1 <1.1.1"
  );

  merge(branches, "next-major", "next");
  merge(branches, "next", "master");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only > than 2.0.1 on master").toBe(">=2.0.1");
  expect(getBranch(result, "next").range, "Can release only > than 2.0.1 on next").toBe(">=2.0.1");
  expect(getBranch(result, "next-major").range, "Can release only > than 2.0.1 on next-major").toBe(">=2.0.1");
  expect(getBranch(result, "1.x").range, "Can release on 1.x only within range").toBe(">=1.1.1 <2.0.0");

  merge(branches, "beta", "master");
  release(branches, "master", "3.0.0");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "master").range, "Can release only > than 3.0.0 on master").toBe(">=3.0.0");
  expect(getBranch(result, "next").range, "Can release only > than 3.0.0 on next").toBe(">=3.0.0");
  expect(getBranch(result, "next-major").range, "Can release only > than 3.0.0 on next-major").toBe(">=3.0.0");

  branches.push({ name: "1.1.x", tags: [] });
  merge(branches, "1.x", "1.1.x");
  result = (await getBranches("repositoryUrl", "master", { options: { branches } })).map(({ name, range }) => ({
    name,
    range,
  }));
  expect(getBranch(result, "1.0.x").range, "Can release on 1.0.x only within range").toBe(">=1.0.4 <1.1.0");
  expect(getBranch(result, "1.1.x").range, "Can release on 1.1.x only within range").toBe(">=1.1.1 <1.2.0");
  expect(getBranch(result, "1.x").range, "Can release on 1.x only within range").toBe(">=1.2.0 <2.0.0");
});

it("Throw SemanticReleaseError for invalid configurations", async (t) => {
  const branches = [
    { name: "123", range: "123", tags: [] },
    { name: "1.x", tags: [] },
    { name: "maintenance-1", range: "1.x", tags: [] },
    { name: "1.x.x", tags: [] },
    { name: "beta", prerelease: "", tags: [] },
    { name: "alpha", prerelease: "alpha", tags: [] },
    { name: "preview", prerelease: "alpha", tags: [] },
  ];
  const context = { options: { branches } };
  expand.mockResolvedValue(remoteBranches);
  getTags.mockResolvedValue(branches);

  const error = await getError(getBranches(repositoryUrl, "master", context));
  const errors = [...error.errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EMAINTENANCEBRANCH");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EMAINTENANCEBRANCHES");
  expect(errors[1].message).toBeTruthy();
  expect(errors[1].details).toBeTruthy();
  expect(errors[2].name).toBe("SemanticReleaseError");
  expect(errors[2].code).toBe("EPRERELEASEBRANCH");
  expect(errors[2].message).toBeTruthy();
  expect(errors[2].details).toBeTruthy();
  expect(errors[3].name).toBe("SemanticReleaseError");
  expect(errors[3].code).toBe("EPRERELEASEBRANCHES");
  expect(errors[3].message).toBeTruthy();
  expect(errors[3].details).toBeTruthy();
  expect(errors[4].name).toBe("SemanticReleaseError");
  expect(errors[4].code).toBe("ERELEASEBRANCHES");
  expect(errors[4].message).toBeTruthy();
  expect(errors[4].details).toBeTruthy();
});

it("Throw a SemanticReleaseError if there is duplicate branches", async (t) => {
  const branches = [
    { name: "master", tags: [] },
    { name: "master", tags: [] },
  ];
  const context = { options: { branches } };
  expand.mockResolvedValue(remoteBranches);
  getTags.mockResolvedValue(branches);

  const errors = [...(await getError(getBranches(repositoryUrl, "master", context))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EDUPLICATEBRANCHES");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it("Throw a SemanticReleaseError for each invalid branch name", async (t) => {
  const branches = [
    { name: "~master", tags: [] },
    { name: "^master", tags: [] },
  ];
  const context = { options: { branches } };
  const remoteBranches = [];
  expand.mockResolvedValue(remoteBranches);
  getTags.mockResolvedValue(branches);

  const errors = [...(await getError(getBranches(repositoryUrl, "master", context))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EINVALIDBRANCHNAME");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EINVALIDBRANCHNAME");
  expect(errors[1].message).toBeTruthy();
  expect(errors[1].details).toBeTruthy();
});
