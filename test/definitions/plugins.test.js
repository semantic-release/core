import { expect, it } from "vitest";
import plugins from "../../lib/definitions/plugins.js";
import { RELEASE_NOTES_SEPARATOR, SECRET_REPLACEMENT } from "../../lib/definitions/constants.js";

it('The "analyzeCommits" plugin output must be either undefined or a valid semver release type', (t) => {
  expect(plugins.analyzeCommits.outputValidator("invalid")).toBe(false);
  expect(plugins.analyzeCommits.outputValidator(1)).toBe(false);
  expect(plugins.analyzeCommits.outputValidator({})).toBe(false);

  expect(plugins.analyzeCommits.outputValidator()).toBe(true);
  expect(plugins.analyzeCommits.outputValidator(null)).toBe(true);
  expect(plugins.analyzeCommits.outputValidator("major")).toBe(true);
});

it('The "generateNotes" plugin output, if defined, must be a string', (t) => {
  expect(plugins.generateNotes.outputValidator(1)).toBe(false);
  expect(plugins.generateNotes.outputValidator({})).toBe(false);

  expect(plugins.generateNotes.outputValidator()).toBe(true);
  expect(plugins.generateNotes.outputValidator(null)).toBe(true);
  expect(plugins.generateNotes.outputValidator("")).toBe(true);
  expect(plugins.generateNotes.outputValidator("string")).toBe(true);
});

it('The "publish" plugin output, if defined, must be an object or "false"', (t) => {
  expect(plugins.publish.outputValidator(1)).toBe(false);
  expect(plugins.publish.outputValidator("string")).toBe(false);

  expect(plugins.publish.outputValidator({})).toBe(true);
  expect(plugins.publish.outputValidator()).toBe(true);
  expect(plugins.publish.outputValidator(null)).toBe(true);
  expect(plugins.publish.outputValidator("")).toBe(true);
  expect(plugins.publish.outputValidator(false)).toBe(true);
});

it('The "addChannel" plugin output, if defined, must be an object', (t) => {
  expect(plugins.addChannel.outputValidator(1)).toBe(false);
  expect(plugins.addChannel.outputValidator("string")).toBe(false);

  expect(plugins.addChannel.outputValidator({})).toBe(true);
  expect(plugins.addChannel.outputValidator()).toBe(true);
  expect(plugins.addChannel.outputValidator(null)).toBe(true);
  expect(plugins.addChannel.outputValidator("")).toBe(true);
});

it('The "generateNotes" plugins output are concatenated with separator and sensitive data is hidden', (t) => {
  const env = { MY_TOKEN: "secret token" };
  expect(plugins.generateNotes.postprocess(["note 1", "note 2"], { env })).toBe(
    `note 1${RELEASE_NOTES_SEPARATOR}note 2`
  );
  expect(plugins.generateNotes.postprocess(["", "note"], { env })).toBe("note");
  expect(plugins.generateNotes.postprocess([undefined, "note"], { env })).toBe("note");
  expect(plugins.generateNotes.postprocess(["note 1", "", "note 2"], { env })).toBe(
    `note 1${RELEASE_NOTES_SEPARATOR}note 2`
  );
  expect(plugins.generateNotes.postprocess(["note 1", undefined, "note 2"], { env })).toBe(
    `note 1${RELEASE_NOTES_SEPARATOR}note 2`
  );

  expect(
    plugins.generateNotes.postprocess(
      [`Note 1: Exposing token ${env.MY_TOKEN}`, `Note 2: Exposing token ${SECRET_REPLACEMENT}`],
      { env }
    )
  ).toBe(
    `Note 1: Exposing token ${SECRET_REPLACEMENT}${RELEASE_NOTES_SEPARATOR}Note 2: Exposing token ${SECRET_REPLACEMENT}`
  );
});

it('The "analyzeCommits" plugins output are reduced to the highest release type', (t) => {
  expect(plugins.analyzeCommits.postprocess(["major", "minor"])).toBe("major");
  expect(plugins.analyzeCommits.postprocess(["", "minor"])).toBe("minor");
  expect(plugins.analyzeCommits.postprocess([undefined, "patch"])).toBe("patch");
  expect(plugins.analyzeCommits.postprocess([null, "patch"])).toBe("patch");
  expect(plugins.analyzeCommits.postprocess(["wrong_type", "minor"])).toBe("minor");
  expect(plugins.analyzeCommits.postprocess([])).toBe(undefined);
  expect(plugins.analyzeCommits.postprocess(["wrong_type"])).toBe(undefined);
});
