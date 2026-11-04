import { expect, it } from "vitest";
import getError from "./helpers/get-error.js";
import { temporaryDirectory } from "tempy";
import verify from "../lib/verify.js";
import { gitRepo } from "./helpers/git-utils.js";

it("Throw a AggregateError", async (t) => {
  const { cwd } = await gitRepo();
  const options = { branches: [{ name: "master" }, { name: "" }] };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("ENOREPOURL");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EINVALIDTAGFORMAT");
  expect(errors[1].message).toBeTruthy();
  expect(errors[1].details).toBeTruthy();
  expect(errors[2].name).toBe("SemanticReleaseError");
  expect(errors[2].code).toBe("ETAGNOVERSION");
  expect(errors[2].message).toBeTruthy();
  expect(errors[2].details).toBeTruthy();
  expect(errors[3].name).toBe("SemanticReleaseError");
  expect(errors[3].code).toBe("EINVALIDBRANCH");
  expect(errors[3].message).toBeTruthy();
  expect(errors[3].details).toBeTruthy();
});

it("Throw a SemanticReleaseError if does not run on a git repository", async (t) => {
  const cwd = temporaryDirectory();
  const options = { branches: [] };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("ENOGITREPO");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it('Throw a SemanticReleaseError if the "tagFormat" is not valid', async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const options = { repositoryUrl, tagFormat: `?\${version}`, branches: [] };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EINVALIDTAGFORMAT");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it('Throw a SemanticReleaseError if the "tagFormat" does not contains the "version" variable', async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const options = { repositoryUrl, tagFormat: "test", branches: [] };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("ETAGNOVERSION");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it('Throw a SemanticReleaseError if the "tagFormat" contains multiple "version" variables', async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const options = { repositoryUrl, tagFormat: `\${version}v\${version}`, branches: [] };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("ETAGNOVERSION");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it('Throw a SemanticReleaseError if the "tagFormat" contains template evaluation syntax', async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const options = {
    repositoryUrl,
    tagFormat: `v\${version}<% process.env.EXFILTRATED = "yes" %>`,
    branches: [],
  };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EINVALIDTAGFORMAT");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it("Throw a SemanticReleaseError for each invalid branch", async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const options = {
    repositoryUrl,
    tagFormat: `v\${version}`,
    branches: [{ name: "" }, { name: "  " }, { name: 1 }, {}, { name: "" }, 1, "master"],
  };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EINVALIDBRANCH");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
  expect(errors[1].name).toBe("SemanticReleaseError");
  expect(errors[1].code).toBe("EINVALIDBRANCH");
  expect(errors[1].message).toBeTruthy();
  expect(errors[1].details).toBeTruthy();
  expect(errors[2].name).toBe("SemanticReleaseError");
  expect(errors[2].code).toBe("EINVALIDBRANCH");
  expect(errors[2].message).toBeTruthy();
  expect(errors[2].details).toBeTruthy();
  expect(errors[3].name).toBe("SemanticReleaseError");
  expect(errors[3].code).toBe("EINVALIDBRANCH");
  expect(errors[3].message).toBeTruthy();
  expect(errors[3].details).toBeTruthy();
  expect(errors[4].code).toBe("EINVALIDBRANCH");
  expect(errors[4].message).toBeTruthy();
  expect(errors[4].details).toBeTruthy();
  expect(errors[5].code).toBe("EINVALIDBRANCH");
  expect(errors[5].message).toBeTruthy();
  expect(errors[5].details).toBeTruthy();
});

it('Throw a SemanticReleaseError if the "repositoryUrl" starts with "-"', async (t) => {
  const { cwd } = await gitRepo(true);
  const options = { repositoryUrl: "--upload-pack=/bin/sh", tagFormat: `v\${version}`, branches: [{ name: "master" }] };

  const errors = [...(await getError(verify({ cwd, options }))).errors];

  expect(errors[0].name).toBe("SemanticReleaseError");
  expect(errors[0].code).toBe("EINVALIDREPOURL");
  expect(errors[0].message).toBeTruthy();
  expect(errors[0].details).toBeTruthy();
});

it('Return "true" if all verification pass', async (t) => {
  const { cwd, repositoryUrl } = await gitRepo(true);
  const options = { repositoryUrl, tagFormat: `v\${version}`, branches: [{ name: "master" }] };

  await verify({ cwd, options });
});
