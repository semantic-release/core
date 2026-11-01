import { expect, it } from "vitest";
import { maintenance, prerelease, release } from "../../lib/definitions/branches.js";

it('A "maintenance" branch is identified by having a "range" property or a "name" formatted like "N.x", "N.x.x" or "N.N.x"', (t) => {
  /* eslint-disable unicorn/no-fn-reference-in-iterator */
  expect(maintenance.filter({ name: "1.x.x" })).toBe(true);
  expect(maintenance.filter({ name: "1.0.x" })).toBe(true);
  expect(maintenance.filter({ name: "1.x" })).toBe(true);
  expect(maintenance.filter({ name: "some-name", range: "1.x.x" })).toBe(true);
  expect(maintenance.filter({ name: "some-name", range: "1.1.x" })).toBe(true);
  expect(maintenance.filter({ name: "some-name", range: "" })).toBe(true);
  expect(maintenance.filter({ name: "some-name", range: true })).toBe(true);

  expect(maintenance.filter({ name: "some-name", range: null })).toBe(false);
  expect(maintenance.filter({ name: "some-name", range: false })).toBe(false);
  expect(maintenance.filter({ name: "some-name" })).toBe(false);
  expect(maintenance.filter({ name: "1.0.0" })).toBe(false);
  expect(maintenance.filter({ name: "1.0" })).toBe(false);
  expect(maintenance.filter({ name: "x.x.x" })).toBe(false);
  /* eslint-enable unicorn/no-fn-reference-in-iterator */
});

it('A "maintenance" branches must have a "range" property formatted like "N.x", "N.x.x" or "N.N.x"', (t) => {
  expect(maintenance.branchValidator({ name: "some-name", range: "1.x.x" })).toBe(true);
  expect(maintenance.branchValidator({ name: "some-name", range: "1.1.x" })).toBe(true);

  expect(maintenance.branchValidator({ name: "some-name", range: "^1.0.0" })).toBe(false);
  expect(maintenance.branchValidator({ name: "some-name", range: ">=1.0.0 <2.0.0" })).toBe(false);
  expect(maintenance.branchValidator({ name: "some-name", range: "1.0.0" })).toBe(false);
  expect(maintenance.branchValidator({ name: "some-name", range: "wrong-range" })).toBe(false);
  expect(maintenance.branchValidator({ name: "some-name", range: true })).toBe(false);
  expect(maintenance.branchValidator({ name: "some-name", range: "" })).toBe(false);
});

it('The "maintenance" branches must have unique ranges', (t) => {
  expect(maintenance.branchesValidator([{ range: "1.x.x" }, { range: "1.0.x" }])).toBe(true);

  expect(maintenance.branchesValidator([{ range: "1.x.x" }, { range: "1.x.x" }])).toBe(false);
  expect(maintenance.branchesValidator([{ range: "1.x.x" }, { range: "1.x" }])).toBe(false);
});

it('A "prerelease" branch is identified by having a thruthy "prerelease" property', (t) => {
  /* eslint-disable unicorn/no-fn-reference-in-iterator */
  expect(prerelease.filter({ name: "some-name", prerelease: true })).toBe(true);
  expect(prerelease.filter({ name: "some-name", prerelease: "beta" })).toBe(true);
  expect(prerelease.filter({ name: "some-name", prerelease: "" })).toBe(true);

  expect(prerelease.filter({ name: "some-name", prerelease: null })).toBe(false);
  expect(prerelease.filter({ name: "some-name", prerelease: false })).toBe(false);
  expect(prerelease.filter({ name: "some-name" })).toBe(false);
  /* eslint-enable unicorn/no-fn-reference-in-iterator */
});

it('A "prerelease" branch must have a valid prerelease detonation in "prerelease" property or in "name" if "prerelease" is "true"', (t) => {
  expect(prerelease.branchValidator({ name: "beta", prerelease: true })).toBe(true);
  expect(prerelease.branchValidator({ name: "some-name", prerelease: "beta" })).toBe(true);

  expect(prerelease.branchValidator({ name: "some-name", prerelease: "" })).toBe(false);
  expect(prerelease.branchValidator({ name: "some-name", prerelease: null })).toBe(false);
  expect(prerelease.branchValidator({ name: "some-name", prerelease: false })).toBe(false);
  expect(prerelease.branchValidator({ name: "some-name", prerelease: "000" })).toBe(false);
  expect(prerelease.branchValidator({ name: "some-name", prerelease: "#beta" })).toBe(false);
  expect(prerelease.branchValidator({ name: "000", prerelease: true })).toBe(false);
  expect(prerelease.branchValidator({ name: "#beta", prerelease: true })).toBe(false);
});

it('The "prerelease" branches must have unique "prerelease" property', (t) => {
  expect(prerelease.branchesValidator([{ prerelease: "beta" }, { prerelease: "alpha" }])).toBe(true);

  expect(prerelease.branchesValidator([{ range: "beta" }, { range: "beta" }, { range: "alpha" }])).toBe(false);
});

it('A "release" branch is identified by not havin a "range" or "prerelease" property or a "name" formatted like "N.x", "N.x.x" or "N.N.x"', (t) => {
  /* eslint-disable unicorn/no-fn-reference-in-iterator */
  expect(release.filter({ name: "some-name" })).toBe(true);

  expect(release.filter({ name: "1.x.x" })).toBe(false);
  expect(release.filter({ name: "1.0.x" })).toBe(false);
  expect(release.filter({ name: "some-name", range: "1.x.x" })).toBe(false);
  expect(release.filter({ name: "some-name", range: "1.1.x" })).toBe(false);
  expect(release.filter({ name: "some-name", prerelease: true })).toBe(false);
  expect(release.filter({ name: "some-name", prerelease: "beta" })).toBe(false);
  /* eslint-enable unicorn/no-fn-reference-in-iterator */
});

it("There must be between 1 and 3 release branches", (t) => {
  expect(release.branchesValidator([{ name: "branch1" }])).toBe(true);
  expect(release.branchesValidator([{ name: "branch1" }, { name: "branch2" }])).toBe(true);
  expect(release.branchesValidator([{ name: "branch1" }, { name: "branch2" }, { name: "branch3" }])).toBe(true);

  expect(release.branchesValidator([])).toBe(false);
  expect(
    release.branchesValidator([{ name: "branch1" }, { name: "branch2" }, { name: "branch3" }, { name: "branch4" }])
  ).toBe(false);
});
