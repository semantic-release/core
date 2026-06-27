import { pick } from "lodash-es";
import { hookStd } from "hook-std";
import semver from "semver";
import AggregateError from "aggregate-error";
import hideSensitive from "./lib/hide-sensitive.js";
import verify from "./lib/verify.js";
import getNextVersion from "./lib/get-next-version.js";
import getCommits from "./lib/get-commits.js";
import getLastRelease from "./lib/get-last-release.js";
import getReleaseToAdd from "./lib/get-release-to-add.js";
import { extractErrors, makeTag } from "./lib/utils.js";
import getGitAuthUrl from "./lib/get-git-auth-url.js";
import getBranches from "./lib/branches/index.js";
import { addNote, getGitHead, getTagHead, isBranchUpToDate, push, pushNotes, tag, verifyAuth } from "./lib/git.js";
import getError from "./lib/get-error.js";
import { normalizePluginsInput } from "./lib/plugins/utils.js";
import { COMMIT_EMAIL, COMMIT_NAME } from "./lib/definitions/constants.js";

export { default as resolveConfig } from "./lib/resolve-config.js";
export { default as getLogger } from "./lib/get-logger.js";
export { default as resolveEnvCi } from "env-ci";

/**
 * Default output formatter that doesn't transform the text, used when the caller doesn't provide one.
 */
async function defaultFormatOutput(text) {
  return text;
}

/* eslint complexity: off */
async function run(context, plugins, formatOutput) {
  const { cwd, env, options, logger } = context;
  const { isPr, prBranch, branch } = context.envCi;
  const ciBranch = isPr ? prBranch : branch;

  // Write the original repository URL to the context options before it gets potentially replaced with an authenticated one, to allow plugins to access it if needed.
  options.originalRepositoryURL = options.repositoryUrl;

  // Verify config
  await verify(context);

  // Replace the repository URL with an authenticated one if possible, to allow pushing the release commits and tags, and fetching the commits to analyze when the repository is private.
  options.repositoryUrl = await getGitAuthUrl({ ...context, branch: { name: ciBranch } });

  context.branches = await getBranches(options.repositoryUrl, ciBranch, context);
  context.branch = context.branches.find(({ name }) => name === ciBranch);

  if (!context.branch) {
    logger.log(
      `This test run was triggered on the branch ${ciBranch}, while semantic-release is configured to only publish from ${context.branches
        .map(({ name }) => name)
        .join(", ")}, therefore a new version won’t be published.`
    );
    return false;
  }

  logger[options.dryRun ? "warn" : "success"](
    `Run automated release from branch ${ciBranch} on repository ${options.originalRepositoryURL}${
      options.dryRun ? " in dry-run mode" : ""
    }`
  );

  try {
    try {
      await verifyAuth(options.repositoryUrl, context.branch.name, { cwd, env });
    } catch (error) {
      if (!(await isBranchUpToDate(options.repositoryUrl, context.branch.name, { cwd, env }))) {
        logger.log(
          `The local branch ${context.branch.name} is behind the remote one, therefore a new version won't be published.`
        );
        return false;
      }

      throw error;
    }
  } catch (error) {
    logger.error(`The command "${error.command}" failed with the error message ${error.stderr}.`);
    throw getError("EGITNOPERMISSION", context);
  }

  logger.success(`Allowed to push to the Git repository`);

  await plugins.verifyConditions(context);

  const errors = [];
  context.releases = [];
  const releaseToAdd = getReleaseToAdd(context);

  if (releaseToAdd) {
    const { lastRelease, currentRelease, nextRelease } = releaseToAdd;

    nextRelease.gitHead = await getTagHead(nextRelease.gitHead, { cwd, env });
    currentRelease.gitHead = await getTagHead(currentRelease.gitHead, { cwd, env });
    if (context.branch.mergeRange && !semver.satisfies(nextRelease.version, context.branch.mergeRange)) {
      errors.push(getError("EINVALIDMAINTENANCEMERGE", { ...context, nextRelease }));
    } else {
      const commits = await getCommits({ ...context, lastRelease, nextRelease });
      nextRelease.notes = await plugins.generateNotes({ ...context, commits, lastRelease, nextRelease });

      if (options.dryRun) {
        logger.warn(`Skip ${nextRelease.gitTag} tag creation in dry-run mode`);
      } else {
        await addNote({ channels: [...currentRelease.channels, nextRelease.channel] }, nextRelease.gitTag, {
          cwd,
          env,
        });
        await push(options.repositoryUrl, { cwd, env });
        await pushNotes(options.repositoryUrl, nextRelease.gitTag, {
          cwd,
          env,
        });
        logger.success(
          `Add ${nextRelease.channel ? `channel ${nextRelease.channel}` : "default channel"} to tag ${
            nextRelease.gitTag
          }`
        );
      }

      context.branch.tags.push({
        version: nextRelease.version,
        channel: nextRelease.channel,
        gitTag: nextRelease.gitTag,
        gitHead: nextRelease.gitHead,
      });

      const releases = await plugins.addChannel({ ...context, commits, lastRelease, currentRelease, nextRelease });
      context.releases.push(...releases);
      await plugins.success({ ...context, lastRelease, commits, nextRelease, releases });
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  context.lastRelease = getLastRelease(context);
  if (context.lastRelease.gitHead) {
    context.lastRelease.gitHead = await getTagHead(context.lastRelease.gitHead, { cwd, env });
  }

  if (context.lastRelease.gitTag) {
    logger.log(
      `Found git tag ${context.lastRelease.gitTag} associated with version ${context.lastRelease.version} on branch ${context.branch.name}`
    );
  } else {
    logger.log(`No git tag version found on branch ${context.branch.name}`);
  }

  context.commits = await getCommits(context);

  const nextRelease = {
    type: await plugins.analyzeCommits(context),
    channel: context.branch.channel || null,
    gitHead: await getGitHead({ cwd, env }),
  };
  if (!nextRelease.type) {
    logger.log("There are no relevant changes, so no new version is released.");
    return context.releases.length > 0 ? { releases: context.releases } : false;
  }

  context.nextRelease = nextRelease;
  nextRelease.version = getNextVersion(context);
  nextRelease.gitTag = makeTag(options.tagFormat, nextRelease.version);
  nextRelease.name = nextRelease.gitTag;

  if (context.branch.type !== "prerelease" && !semver.satisfies(nextRelease.version, context.branch.range)) {
    throw getError("EINVALIDNEXTVERSION", {
      ...context,
      validBranches: context.branches.filter(
        ({ type, accept }) => type !== "prerelease" && accept.includes(nextRelease.type)
      ),
    });
  }

  await plugins.verifyRelease(context);

  nextRelease.notes = await plugins.generateNotes(context);

  await plugins.prepare(context);

  if (options.dryRun) {
    logger.warn(`Skip ${nextRelease.gitTag} tag creation in dry-run mode`);
  } else {
    // Create the tag before calling the publish plugins as some require the tag to exists
    await tag(nextRelease.gitTag, nextRelease.gitHead, { cwd, env });
    await addNote({ channels: [nextRelease.channel] }, nextRelease.gitTag, { cwd, env });
    await push(options.repositoryUrl, { cwd, env });
    await pushNotes(options.repositoryUrl, nextRelease.gitTag, { cwd, env });
    logger.success(`Created tag ${nextRelease.gitTag}`);
  }

  const releases = await plugins.publish(context);
  context.releases.push(...releases);

  await plugins.success({ ...context, releases });

  logger[options.dryRun ? "warn" : "success"](
    `Release ${nextRelease.version} ${options.dryRun ? "would be published" : "published"} on ${
      nextRelease.channel ? nextRelease.channel : "default"
    } channel`
  );

  if (options.dryRun && nextRelease.notes) {
    logger.log(`Release note for version ${nextRelease.version}:`);
    context.stdout.write(await formatOutput(nextRelease.notes));
  }

  return pick(context, ["lastRelease", "commits", "nextRelease", "releases"]);
}

/**
 * Log errors in a consistent way, with semantic-release errors first and their details if available, then other errors.
 */
async function logErrors({ logger, stderr }, err, formatOutput) {
  const errors = extractErrors(err).sort((error) => (error.semanticRelease ? -1 : 0));
  for (const error of errors) {
    if (error.semanticRelease) {
      logger.error(`${error.code} ${error.message}`);
      if (error.details) {
        stderr.write(await formatOutput(error.details)); // eslint-disable-line no-await-in-loop
      }
    } else {
      logger.error("An error occurred while running semantic-release: %O", error);
    }
  }
}

/**
 * Call the fail plugin with the extracted semantic-release errors.
 */
async function callFail(context, plugins, err, formatOutput) {
  const errors = extractErrors(err).filter((err) => err.semanticRelease);
  if (errors.length > 0) {
    try {
      await plugins.fail({ ...context, errors });
    } catch (error) {
      await logErrors(context, error, formatOutput);
    }
  }
}

/**
 * Validate that the provided context contains the required fields and throw a semantic-release error if not.
 */
function validateContextContract(context) {
  const requiredContextFields = ["options", "envCi", "logger", "stdout", "stderr"];

  for (const field of requiredContextFields) {
    if (!context?.[field]) {
      throw new TypeError(`core context.${field} must be provided by the caller`);
    }
  }
}

/**
 * Apply default Git environment variables to the provided env object, if they are not already set. This ensures that Git commands run with the expected author and committer information, and that prompts for credentials are suppressed in CI environments.
 */
function applyGitEnvDefaults(env) {
  if (!env) {
    return;
  }

  Object.assign(env, {
    GIT_AUTHOR_NAME: env.GIT_AUTHOR_NAME ?? COMMIT_NAME,
    GIT_AUTHOR_EMAIL: env.GIT_AUTHOR_EMAIL ?? COMMIT_EMAIL,
    GIT_COMMITTER_NAME: env.GIT_COMMITTER_NAME ?? COMMIT_NAME,
    GIT_COMMITTER_EMAIL: env.GIT_COMMITTER_EMAIL ?? COMMIT_EMAIL,
    GIT_ASKPASS: env.GIT_ASKPASS ?? "echo",
    GIT_TERMINAL_PROMPT: env.GIT_TERMINAL_PROMPT ?? 0,
  });
}

/**
 * Run semantic-release with the provided context and plugins, and handle errors in a consistent way, with semantic-release errors first and their details if available, then other errors.
 */
export default async ({ context, plugins, onInit, formatOutput = defaultFormatOutput }) => {
  if (typeof formatOutput !== "function") {
    throw new TypeError("core formatOutput input must be a function when provided");
  }

  validateContextContract(context);
  applyGitEnvDefaults(context.env);

  if (!plugins) {
    throw new TypeError("core plugins input must be provided by the caller");
  }

  const { unhook } = hookStd(
    { silent: false, streams: [process.stdout, process.stderr, context.stdout, context.stderr].filter(Boolean) },
    hideSensitive(context.env)
  );

  try {
    if (onInit) {
      await onInit(context);
    }
    const normalizedPlugins = await normalizePluginsInput(context, plugins);
    try {
      const result = await run(context, normalizedPlugins, formatOutput);
      unhook();
      return result;
    } catch (error) {
      await callFail(context, normalizedPlugins, error, formatOutput);
      throw error;
    }
  } catch (error) {
    await logErrors(context, error, formatOutput);
    unhook();
    throw error;
  }
};
