import test from "ava";
import * as errors from "../../lib/definitions/errors.js";

const docsRelatedErrors = [
  () => errors.ENOREPOURL(),
  () =>
    errors.EGITNOPERMISSION({
      options: { repositoryUrl: "https://github.com/semantic-release/core" },
      branch: { name: "main" },
    }),
  () => errors.EINVALIDTAGFORMAT({ options: { tagFormat: "v${version}" } }),
  () => errors.ETAGNOVERSION({ options: { tagFormat: "v1.0.0" } }),
  () =>
    errors.EPLUGINCONF({
      type: "analyzeCommits",
      required: true,
      pluginConf: ["@semantic-release/commit-analyzer"],
    }),
  () => errors.EMISSINGREQUIREDPLUGIN({ type: "analyzeCommits" }),
  () => errors.EPLUGINSCONF({ plugin: ["@semantic-release/commit-analyzer"] }),
  () => errors.EPLUGIN({ pluginName: "not-a-plugin", type: "analyzeCommits" }),
  () => errors.EANALYZECOMMITSOUTPUT({ result: "wrong", pluginName: "plugin-name" }),
  () => errors.EGENERATENOTESOUTPUT({ result: 1, pluginName: "plugin-name" }),
  () => errors.EPUBLISHOUTPUT({ result: "wrong", pluginName: "plugin-name" }),
  () => errors.EADDCHANNELOUTPUT({ result: "wrong", pluginName: "plugin-name" }),
  () => errors.EINVALIDBRANCH({ branch: { name: "main" } }),
  () => errors.EINVALIDBRANCHNAME({ branch: { name: "feature/branch" } }),
  () => errors.EDUPLICATEBRANCHES({ duplicates: ["main", "release"] }),
  () => errors.EMAINTENANCEBRANCH({ branch: { name: "1.x", range: "1.x" } }),
  () => errors.EMAINTENANCEBRANCHES({ branches: [{ name: "1.x" }, { name: "1.0.x" }] }),
  () => errors.ERELEASEBRANCHES({ branches: [{ name: "main" }] }),
  () => errors.EPRERELEASEBRANCH({ branch: { name: "beta", prerelease: true } }),
  () => errors.EPRERELEASEBRANCHES({ branches: [{ name: "beta", prerelease: "beta" }] }),
  () =>
    errors.EINVALIDNEXTVERSION({
      nextRelease: { version: "2.0.0" },
      branch: { name: "main", range: "1.x" },
      commits: [{ commit: { short: "abc1234" }, subject: "feat: break range" }],
      validBranches: [{ name: "next" }, { name: "main" }],
    }),
  () =>
    errors.EINVALIDMAINTENANCEMERGE({
      nextRelease: { channel: "latest", gitTag: "v2.0.0", version: "2.0.0" },
      branch: { name: "1.x", mergeRange: "<=1.5.0" },
    }),
];

const docsBaseUrl = "https://semantic-release.org";

const assertErrorShape = (t, error, { messageIncludes, detailsIncludes }) => {
  t.truthy(error);
  t.is(typeof error.message, "string");
  t.is(typeof error.details, "string");

  if (messageIncludes) {
    t.true(error.message.includes(messageIncludes));
  }

  for (const expected of detailsIncludes ?? []) {
    t.true(error.details.includes(expected));
  }
};

test("Every exported error factory returns a structured error payload", (t) => {
  const cases = [
    { error: errors.ENOGITREPO({ cwd: "/repo" }), messageIncludes: "git repository", detailsIncludes: ["/repo"] },
    {
      error: errors.ENOREPOURL(),
      messageIncludes: "repositoryUrl",
      detailsIncludes: [docsBaseUrl, "repositoryUrl option"],
    },
    {
      error: errors.EGITNOPERMISSION({
        options: { repositoryUrl: "https://github.com/semantic-release/core" },
        branch: { name: "main" },
      }),
      messageIncludes: "Cannot push",
      detailsIncludes: [docsBaseUrl, "main", "repositoryUrl"],
    },
    {
      error: errors.EINVALIDTAGFORMAT({ options: { tagFormat: "v${version}" } }),
      messageIncludes: "tagFormat",
      detailsIncludes: [docsBaseUrl, "tagFormat"],
    },
    {
      error: errors.ETAGNOVERSION({ options: { tagFormat: "v1.0.0" } }),
      messageIncludes: "tagFormat",
      detailsIncludes: [docsBaseUrl, "version"],
    },
    {
      error: errors.EPLUGINCONF({
        type: "analyzeCommits",
        required: true,
        pluginConf: ["@semantic-release/commit-analyzer"],
      }),
      messageIncludes: "analyzeCommits",
      detailsIncludes: [docsBaseUrl, "analyzeCommits", "@semantic-release/commit-analyzer"],
    },
    {
      error: errors.EMISSINGREQUIREDPLUGIN({ type: "analyzeCommits" }),
      messageIncludes: "required",
      detailsIncludes: [docsBaseUrl, "analyzeCommits", "@semantic-release/commit-analyzer"],
    },
    {
      error: errors.EPLUGINSCONF({ plugin: ["@semantic-release/commit-analyzer"] }),
      messageIncludes: "plugins",
      detailsIncludes: [docsBaseUrl, "@semantic-release/commit-analyzer"],
    },
    {
      error: errors.EPLUGIN({ pluginName: "not-a-plugin", type: "analyzeCommits" }),
      messageIncludes: "analyzeCommits",
      detailsIncludes: [docsBaseUrl, "not-a-plugin"],
    },
    {
      error: errors.EANALYZECOMMITSOUTPUT({ result: "wrong", pluginName: "plugin-name" }),
      messageIncludes: "analyzeCommits",
      detailsIncludes: [docsBaseUrl, "plugin-name", "wrong"],
    },
    {
      error: errors.EGENERATENOTESOUTPUT({ result: 1, pluginName: "plugin-name" }),
      messageIncludes: "generateNotes",
      detailsIncludes: [docsBaseUrl, "plugin-name"],
    },
    {
      error: errors.EPUBLISHOUTPUT({ result: "wrong", pluginName: "plugin-name" }),
      messageIncludes: "publish",
      detailsIncludes: [docsBaseUrl, "plugin-name"],
    },
    {
      error: errors.EADDCHANNELOUTPUT({ result: "wrong", pluginName: "plugin-name" }),
      messageIncludes: "addChannel",
      detailsIncludes: [docsBaseUrl, "plugin-name"],
    },
    {
      error: errors.EINVALIDBRANCH({ branch: { name: "main" } }),
      messageIncludes: "branches",
      detailsIncludes: [docsBaseUrl, "main"],
    },
    {
      error: errors.EINVALIDBRANCHNAME({ branch: { name: "feature/branch" } }),
      messageIncludes: "branches",
      detailsIncludes: [docsBaseUrl, "feature/branch"],
    },
    {
      error: errors.EDUPLICATEBRANCHES({ duplicates: ["main", "release"] }),
      messageIncludes: "duplicate",
      detailsIncludes: [docsBaseUrl, "main", "release"],
    },
    {
      error: errors.EMAINTENANCEBRANCH({ branch: { name: "1.x", range: "1.x" } }),
      messageIncludes: "maintenance branch",
      detailsIncludes: [docsBaseUrl, "1.x"],
    },
    {
      error: errors.EMAINTENANCEBRANCHES({ branches: [{ name: "1.x" }, { name: "1.0.x" }] }),
      messageIncludes: "maintenance branches",
      detailsIncludes: [docsBaseUrl, "1.0.x"],
    },
    {
      error: errors.ERELEASEBRANCHES({ branches: [{ name: "main" }] }),
      messageIncludes: "release branches",
      detailsIncludes: [docsBaseUrl, "main"],
    },
    {
      error: errors.EPRERELEASEBRANCH({ branch: { name: "beta", prerelease: true } }),
      messageIncludes: "pre-release branch",
      detailsIncludes: [docsBaseUrl, "beta"],
    },
    {
      error: errors.EPRERELEASEBRANCHES({ branches: [{ name: "beta", prerelease: "beta" }] }),
      messageIncludes: "pre-release branches",
      detailsIncludes: [docsBaseUrl, "beta"],
    },
    {
      error: errors.EINVALIDNEXTVERSION({
        nextRelease: { version: "2.0.0" },
        branch: { name: "main", range: "1.x" },
        commits: [{ commit: { short: "abc1234" }, subject: "feat: break range" }],
        validBranches: [{ name: "next" }, { name: "main" }],
      }),
      messageIncludes: "2.0.0",
      detailsIncludes: [docsBaseUrl, "feat: break range", "abc1234", "main"],
    },
    {
      error: errors.EINVALIDMAINTENANCEMERGE({
        nextRelease: { channel: "latest", gitTag: "v2.0.0", version: "2.0.0" },
        branch: { name: "1.x", mergeRange: "<=1.5.0" },
      }),
      messageIncludes: "2.0.0",
      detailsIncludes: [docsBaseUrl, "latest", "v2.0.0", "1.x"],
    },
  ];

  for (const testCase of cases) {
    assertErrorShape(t, testCase.error, testCase);
  }
});
