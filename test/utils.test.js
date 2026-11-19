import { expect, it } from "vitest";
import AggregateError from "aggregate-error";
import {
  extractErrors,
  getEarliestVersion,
  getFirstVersion,
  getLatestVersion,
  getLowerBound,
  getRange,
  getUpperBound,
  getVersionDiff,
  highest,
  isMaintenanceRange,
  isMajorRange,
  isSameChannel,
  lowest,
  makeTag,
  extractGitLogTags,
  tagsToVersions,
} from "../lib/utils.js";

it("extractErrors", (t) => {
  const errors = [new Error("Error 1"), new Error("Error 2")];

  expect(extractErrors(new AggregateError(errors))).toEqual(errors);
  expect(extractErrors(errors[0])).toEqual([errors[0]]);
});

it("tagsToVersions", (t) => {
  expect(tagsToVersions([{ version: "1.0.0" }, { version: "1.1.0" }, { version: "1.2.0" }])).toEqual([
    "1.0.0",
    "1.1.0",
    "1.2.0",
  ]);
});

it("isMajorRange", (t) => {
  expect(isMajorRange("1.1.x")).toBe(false);
  expect(isMajorRange("1.11.x")).toBe(false);
  expect(isMajorRange("11.1.x")).toBe(false);
  expect(isMajorRange("11.11.x")).toBe(false);
  expect(isMajorRange("1.1.X")).toBe(false);
  expect(isMajorRange("1.1.0")).toBe(false);

  expect(isMajorRange("1.x.x")).toBe(true);
  expect(isMajorRange("11.x.x")).toBe(true);
  expect(isMajorRange("1.X.X")).toBe(true);
  expect(isMajorRange("1.x")).toBe(true);
  expect(isMajorRange("11.x")).toBe(true);
  expect(isMajorRange("1.X")).toBe(true);
});

it("isMaintenanceRange", (t) => {
  expect(isMaintenanceRange("1.1.x")).toBe(true);
  expect(isMaintenanceRange("11.1.x")).toBe(true);
  expect(isMaintenanceRange("11.11.x")).toBe(true);
  expect(isMaintenanceRange("1.11.x")).toBe(true);
  expect(isMaintenanceRange("1.x.x")).toBe(true);
  expect(isMaintenanceRange("11.x.x")).toBe(true);
  expect(isMaintenanceRange("1.x")).toBe(true);
  expect(isMaintenanceRange("11.x")).toBe(true);
  expect(isMaintenanceRange("1.1.X")).toBe(true);
  expect(isMaintenanceRange("1.X.X")).toBe(true);
  expect(isMaintenanceRange("1.X")).toBe(true);

  expect(isMaintenanceRange("1.1.0")).toBe(false);
  expect(isMaintenanceRange("11.1.0")).toBe(false);
  expect(isMaintenanceRange("1.11.0")).toBe(false);
  expect(isMaintenanceRange("11.11.0")).toBe(false);
  expect(isMaintenanceRange("~1.0.0")).toBe(false);
  expect(isMaintenanceRange("^1.0.0")).toBe(false);
});

it("getUpperBound", (t) => {
  expect(getUpperBound("1.x.x")).toBe("2.0.0");
  expect(getUpperBound("1.X.X")).toBe("2.0.0");
  expect(getUpperBound("10.x.x")).toBe("11.0.0");
  expect(getUpperBound("1.x")).toBe("2.0.0");
  expect(getUpperBound("10.x")).toBe("11.0.0");
  expect(getUpperBound("1.0.x")).toBe("1.1.0");
  expect(getUpperBound("10.0.x")).toBe("10.1.0");
  expect(getUpperBound("10.10.x")).toBe("10.11.0");
  expect(getUpperBound("1.0.0")).toBe("1.0.0");
  expect(getUpperBound("10.0.0")).toBe("10.0.0");

  expect(getUpperBound("foo")).toBe(undefined);
});

it("getLowerBound", (t) => {
  expect(getLowerBound("1.x.x")).toBe("1.0.0");
  expect(getLowerBound("1.X.X")).toBe("1.0.0");
  expect(getLowerBound("10.x.x")).toBe("10.0.0");
  expect(getLowerBound("1.x")).toBe("1.0.0");
  expect(getLowerBound("10.x")).toBe("10.0.0");
  expect(getLowerBound("1.0.x")).toBe("1.0.0");
  expect(getLowerBound("10.0.x")).toBe("10.0.0");
  expect(getLowerBound("1.10.x")).toBe("1.10.0");
  expect(getLowerBound("1.0.0")).toBe("1.0.0");
  expect(getLowerBound("10.0.0")).toBe("10.0.0");

  expect(getLowerBound("foo")).toBe(undefined);
});

it("highest", (t) => {
  expect(highest("1.0.0", "2.0.0")).toBe("2.0.0");
  expect(highest("1.1.1", "1.1.0")).toBe("1.1.1");
  expect(highest(null, "1.0.0")).toBe("1.0.0");
  expect(highest("1.0.0")).toBe("1.0.0");
  expect(highest()).toBe(undefined);
});

it("lowest", (t) => {
  expect(lowest("1.0.0", "2.0.0")).toBe("1.0.0");
  expect(lowest("1.1.1", "1.1.0")).toBe("1.1.0");
  expect(lowest(null, "1.0.0")).toBe("1.0.0");
  expect(lowest()).toBe(undefined);
});

it("getLatestVersion", (t) => {
  expect(getLatestVersion(["1.2.3-alpha.3", "1.2.0", "1.0.1", "1.0.0-alpha.1"])).toBe("1.2.0");
  expect(getLatestVersion(["1.2.3-alpha.3", "1.2.3-alpha.2"])).toBe(undefined);

  expect(getLatestVersion(["1.2.3-alpha.3", "1.2.0", "1.0.1", "1.0.0-alpha.1"])).toBe("1.2.0");
  expect(getLatestVersion(["1.2.3-alpha.3", "1.2.3-alpha.2"])).toBe(undefined);

  expect(getLatestVersion(["1.2.3-alpha.3", "1.2.0", "1.0.1", "1.0.0-alpha.1"], { withPrerelease: true })).toBe(
    "1.2.3-alpha.3"
  );
  expect(getLatestVersion(["1.2.3-alpha.3", "1.2.3-alpha.2"], { withPrerelease: true })).toBe("1.2.3-alpha.3");

  expect(getLatestVersion([])).toBe(undefined);
});

it("getEarliestVersion", (t) => {
  expect(getEarliestVersion(["1.2.3-alpha.3", "1.2.0", "1.0.0", "1.0.1-alpha.1"])).toBe("1.0.0");
  expect(getEarliestVersion(["1.2.3-alpha.3", "1.2.3-alpha.2"])).toBe(undefined);

  expect(getEarliestVersion(["1.2.3-alpha.3", "1.2.0", "1.0.0", "1.0.1-alpha.1"])).toBe("1.0.0");
  expect(getEarliestVersion(["1.2.3-alpha.3", "1.2.3-alpha.2"])).toBe(undefined);

  expect(getEarliestVersion(["1.2.3-alpha.3", "1.2.0", "1.0.1", "1.0.0-alpha.1"], { withPrerelease: true })).toBe(
    "1.0.0-alpha.1"
  );
  expect(getEarliestVersion(["1.2.3-alpha.3", "1.2.3-alpha.2"], { withPrerelease: true })).toBe("1.2.3-alpha.2");

  expect(getEarliestVersion([])).toBe(undefined);
});

it("getFirstVersion", (t) => {
  expect(getFirstVersion(["1.2.0", "1.0.0", "1.3.0", "1.1.0", "1.4.0"], [])).toBe("1.0.0");
  expect(
    getFirstVersion(
      ["1.2.0", "1.0.0", "1.3.0", "1.1.0", "1.4.0"],
      [
        { name: "master", tags: [{ version: "1.0.0" }, { version: "1.1.0" }] },
        { name: "next", tags: [{ version: "1.0.0" }, { version: "1.1.0" }, { version: "1.2.0" }] },
      ]
    )
  ).toBe("1.3.0");
  expect(
    getFirstVersion(
      ["1.2.0", "1.0.0", "1.1.0"],
      [
        { name: "master", tags: [{ version: "1.0.0" }, { version: "1.1.0" }] },
        { name: "next", tags: [{ version: "1.0.0" }, { version: "1.1.0" }, { version: "1.2.0" }] },
      ]
    )
  ).toBe(undefined);
});

it("getRange", (t) => {
  expect(getRange("1.0.0", "1.1.0")).toBe(">=1.0.0 <1.1.0");
  expect(getRange("1.0.0")).toBe(">=1.0.0");
});

it("makeTag", (t) => {
  expect(makeTag(`v\${version}`, "1.0.0")).toBe("v1.0.0");
  expect(makeTag(`v\${version}<% process.env.TEST = "x" %>`, "1.0.0")).toBe(`v1.0.0<% process.env.TEST = "x" %>`);
});

it("isSameChannel", (t) => {
  expect(isSameChannel("next", "next")).toBe(true);
  expect(isSameChannel(null, undefined)).toBe(true);
  expect(isSameChannel(false, undefined)).toBe(true);
  expect(isSameChannel("", false)).toBe(true);

  expect(isSameChannel("next", false)).toBe(false);
});

it("extractGitLogTags", (t) => {
  expect(extractGitLogTags(`(tag: v1.2.3)`)).toEqual(["v1.2.3"]);
  expect(extractGitLogTags(`(tag: v1.2.3, tag: 5833/merge)`)).toEqual(["v1.2.3", "5833/merge"]);
});

it("getVersionDiff", (t) => {
  expect(getVersionDiff("1.0.0", "2.0.0")).toBe("major");
  expect(getVersionDiff("1.0.0", "1.1.0")).toBe("minor");
  expect(getVersionDiff("1.0.0", "1.0.1")).toBe("patch");
  expect(getVersionDiff("1.0.0", "2.0.0-alpha.1")).toBe("premajor");
  expect(getVersionDiff("1.0.0", "1.1.0-alpha.1")).toBe("preminor");
  expect(getVersionDiff("1.0.0", "1.0.1-alpha.1")).toBe("prepatch");
  expect(getVersionDiff("1.0.0-alpha.1", "1.0.0-alpha.2")).toBe("prerelease");

  expect(getVersionDiff("2.0.0", "1.0.0")).toBe(undefined);
  expect(getVersionDiff("1.1.0", "1.0.0")).toBe(undefined);
  expect(getVersionDiff("1.0.1", "1.0.0")).toBe(undefined);
  expect(getVersionDiff("1.0.0", "1.0.0")).toBe(undefined);
});
