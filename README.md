# @semantic-release/core

`@semantic-release/core` is the composable release engine behind [semantic-release](https://github.com/semantic-release/semantic-release). It owns orchestration, config resolution, branch validation, plugin execution, and git interactions, while leaving CLI parsing and wrapper defaults to higher-level packages.

Use this package when you want to build a custom release workflow, compose your own CLI, or run semantic-release with an explicit plugin stack.

## Installation

```bash
npm install @semantic-release/core
```

## Public API

The package exports four public entry points:

- [`default`](#default): run a release with an explicit execution `context`, `plugins` input, optional `onInit` callback, and optional terminal `formatOutput` formatter.
- [`resolveConfig(context, runtimeOptions?, configOptions?)`](#resolveconfigcontext-runtimeoptions-configoptions): resolve configuration and, when requested, build the plugin pipeline.
- [`getLogger({ stdout, stderr })`](#getlogger-stdout-stderr-): create the logger used by semantic-release.
- [`resolveEnvCi({ env?, cwd? })`](#resolveenvci-env-cwd-): resolve CI metadata for the current environment.

### `default`

Execute one full release run: verify context, normalize plugins, analyze commits, prepare, tag, publish, and call success/fail hooks.

Signature:

```ts
default(input: {
  context: Context;
  plugins: PluginsInput;
  onInit?: (context: Context) => Promise<void> | void;
  formatOutput?: (text: string) => string | Promise<string>;
}): Promise<false | { lastRelease; commits; nextRelease; releases }>
```

Inputs:

- `context` (required): execution context. Must include `context.options`.
- `plugins` (required): explicit plugin source for the run.
- `onInit` (optional): hook called before plugin normalization.
- `formatOutput` (optional): formatter used before writing markdown release notes or semantic-release error details to terminal streams.

Behavior notes:

- Throws a `TypeError` when `context.options` or `plugins` is missing.
- Returns `false` when no release should be performed.
- Returns a result object when a release is added or published.
- Calls `plugins.fail` with extracted semantic-release errors when possible.
- Does not implement wrapper-level CI policy guards such as pull-request skip or auto dry-run.

Result shape:

- `lastRelease`: last matching release on the active branch.
- `commits`: commits used for analysis.
- `nextRelease`: computed next release metadata (when applicable).
- `releases`: publish/addChannel outputs from plugins.

### `resolveConfig(context, runtimeOptions?, configOptions?)`

Resolve semantic-release config into normalized `options`, and optionally build a normalized plugin pipeline.

Signature:

```ts
resolveConfig(
  context: Context,
  runtimeOptions?: Options,
  configOptions?: {
    buildPlugins?: boolean;
    baseConfig?: string | object;
  }
): Promise<{ options } | { options; plugins }>
```

Inputs:

- `context` (required): runtime context used during resolution (typically includes `cwd`, `env`, `envCi`, `stdout`, `stderr`, and `logger`).
- `runtimeOptions` (optional): caller-provided semantic-release options that override values from config files and shareable configs.
- `configOptions` (optional): controls how config resolution is performed. `configOptions` fields:
  - `buildPlugins` (optional, default `false`):
    - `true`: resolve config and build/normalize plugin pipeline.
    - `false`: resolve config only; plugin loading is deferred to the caller.
  - `baseConfig` (optional): seed config source (for example a shareable-config name or object) used as a base during resolution.

Return value:

- Always returns normalized `options`.
- Returns `plugins` only when `configOptions.buildPlugins` is `true`.

Typical usage:

- Use `configOptions.buildPlugins: true` to return both `options` and `plugins` for [config-driven composition](#1-config-driven-composition).
- Use `configOptions.buildPlugins: false` to resolve `options` only and provide `plugins` explicitly to the default export for [direct composition](#2-direct-composition).
- Use `configOptions.buildPlugins: false` when wrapper code needs to read `options.plugins`, enforce required plugins, and then pass the final plugin list explicitly to the default export for [direct composition](#2-direct-composition).

### `getLogger({ stdout, stderr })`

Create a logger instance compatible with core/plugin execution.

Inputs:

- `stdout` and `stderr` writable streams (required).

Behavior notes:

- `getLogger` does not inject fallback process streams. Passing missing streams (for example `getLogger({})`) produces an unusable logger.
- Use this output to populate `context.logger` before calling `resolveConfig` or `default`.
- The logger supports semantic-release style levels (`log`, `success`, `warn`, `error`, `start`, `skip`, `complete`).

### `resolveEnvCi({ env?, cwd? })`

Detect CI runtime metadata (for example branch/pr context) using the current process environment and working directory.

Inputs:

- `env` (optional): environment variable object. Defaults to `process.env`.
- `cwd` (optional): working directory. Defaults to `process.cwd()`.

Behavior notes:

- Use this output to populate `context.envCi` before calling `resolveConfig` or `default`.
- Wrapper packages can apply additional policy on top of the detected CI state.

## Supported composition paths

There are two supported ways to compose core.

### 1. Config-driven composition

Use `resolveConfig(..., { buildPlugins: true })` when you want core to resolve configuration and build the plugin pipeline for you.

```js
import semanticRelease, { getLogger, resolveConfig, resolveEnvCi } from "@semantic-release/core";

const cwd = process.cwd();
const env = process.env;
const envCi = resolveEnvCi({ cwd, env });
const logger = getLogger({ stdout: process.stdout, stderr: process.stderr });

const context = {
  cwd,
  env,
  envCi,
  logger,
  stdout: process.stdout,
  stderr: process.stderr,
};
const runtimeOptions = { dryRun: true };

const { options, plugins } = await resolveConfig(context, runtimeOptions, {
  buildPlugins: true,
  baseConfig: "@my-org/release-config",
});

const result = await semanticRelease({
  context: { ...context, options },
  plugins,
});
```

### 2. Direct composition

Pass an explicit plugin list or plugin pipeline directly to core when you want the plugin source to be authoritative in your code.

If you only want configuration resolution, use `resolveConfig(..., { buildPlugins: false })` and provide plugins separately.

```js
import semanticRelease, { getLogger, resolveConfig, resolveEnvCi } from "@semantic-release/core";

const cwd = process.cwd();
const env = process.env;
const envCi = resolveEnvCi({ cwd, env });
const logger = getLogger({ stdout: process.stdout, stderr: process.stderr });

const context = {
  cwd,
  env,
  envCi,
  logger,
  stdout: process.stdout,
  stderr: process.stderr,
};
const runtimeOptions = {
  ci: true,
  dryRun: true,
};

const { options } = await resolveConfig(context, runtimeOptions, {
  buildPlugins: false,
});

const result = await semanticRelease({
  context: { ...context, options },
  plugins: ["@semantic-release/commit-analyzer"],
});
```

Wrappers can also use `resolveConfig(..., { buildPlugins: false })` to read configured plugin specs, apply wrapper policy, and then pass the final plugin list explicitly to core. This remains direct composition because the explicit `plugins` argument is still authoritative.

```js
import semanticRelease, { getLogger, resolveConfig, resolveEnvCi } from "@semantic-release/core";

const BASE_CONFIG = {
  plugins: ["@semantic-release/commit-analyzer", "@semantic-release/release-notes-generator"],
};

function ensureRequiredPlugins(configuredPlugins) {
  return configuredPlugins.includes("@semantic-release/git")
    ? configuredPlugins
    : [...configuredPlugins, "@semantic-release/git"];
}

const cwd = process.cwd();
const env = process.env;
const envCi = resolveEnvCi({ cwd, env });
const logger = getLogger({ stdout: process.stdout, stderr: process.stderr });

const context = {
  cwd,
  env,
  envCi,
  logger,
  stdout: process.stdout,
  stderr: process.stderr,
};

const { options } = await resolveConfig(
  context,
  {},
  {
    buildPlugins: false,
    baseConfig: BASE_CONFIG,
  }
);

const configuredPlugins = Array.isArray(options.plugins) ? options.plugins : [];
const plugins = ensureRequiredPlugins(configuredPlugins);

await semanticRelease({
  context: { ...context, options },
  plugins,
});
```

In the direct-composition path, any plugin list passed to core is the plugin source, whether it comes directly from caller code or from wrapper code that first reads `options.plugins`. `options.plugins` from config or shareable-config `extends` is not used as a fallback source for plugin loading once the caller passes `plugins` explicitly.

## Core contract

The default export expects an object with:

- `context`: a release context that must include `context.options`.
- `plugins`: the explicit plugin input for the run.
- `onInit?`: an optional hook that runs before plugin normalization.
- `formatOutput?`: optional formatter for markdown output written to `stdout`/`stderr`.

`context.options` is required. `plugins` is required.

The release context should include the standard semantic-release runtime fields such as `cwd`, `env`, `envCi`, `stdout`, `stderr`, and `logger`.

## `analyzeCommits` fallback injection

Core injects `@semantic-release/commit-analyzer` as a fallback for `analyzeCommits` only when all of the following are true:

- No plugin in the plugin list already provides `analyzeCommits`.
- `options.analyzeCommits` is not already an explicit plugin spec.

An explicit plugin spec means one of these forms:

- a string
- a function
- an array plugin spec
- a plain object with a `path`

When `options.analyzeCommits` is a plain object without `path`, core treats it as step configuration and merges it into the injected fallback plugin. If you want the highest-release-type-wins behavior from multiple analyzers, include `@semantic-release/commit-analyzer` explicitly in your plugin list.

Examples:

- Plugin list covers `analyzeCommits` -> no fallback injection.
- `options.analyzeCommits` is a plugin spec -> no fallback injection.
- `options.analyzeCommits` is an options-only plain object or is absent -> commit-analyzer is injected and the options are merged into it.

## Git process environment defaults

The Git process environment is what core and git use to make automated releases non-interactive and to attribute commits and tags correctly in CI.

Set these values before building the release `context` so `context.env` already includes them.

The example below shows the Git process environment values a caller or wrapper can set for CI.

Typical caller-provided CI setup:

```js
Object.assign(env, {
  GIT_AUTHOR_NAME: "semantic-release-bot",
  GIT_AUTHOR_EMAIL: "semantic-release-bot@semantic-release.org",
  GIT_COMMITTER_NAME: "semantic-release-bot",
  GIT_COMMITTER_EMAIL: "semantic-release-bot@semantic-release.org",
  ...env,
  GIT_ASKPASS: "echo",
  GIT_TERMINAL_PROMPT: 0,
});
```

For each of these value that you do not set, core applies its own defaults.

## Dependency and ownership model

`@semantic-release/core` does not own CLI parsing or wrapper defaults.

- Core owns the release engine and config-resolution API.
- Core expects callers to provide plugins explicitly.
- Wrapper packages can layer default plugins, CLI flags, or output formatting on top of core.
- Wrapper/caller code owns CI policy decisions (for example PR skip and auto dry-run behavior).
- Core applies default git process environment hardening when values are missing; see [Git process environment defaults](#git-process-environment-defaults).
- Wrapper/caller code can override any of those defaults by providing explicit values on `context.env`.

## Plugin loading security model

Plugin resolution is a trusted-code execution boundary. Plugin specs and shareable configuration sources can load code dynamically, so only use sources you trust.

Recommended hardening practices:

- protect release branches
- use least-privilege CI tokens
- enforce lockfile integrity with `npm ci`
- prefer trusted shareable-config sources
- make plugin-load failures visible in CI logs

## TypeScript

The package ships TypeScript declarations. A minimal typed setup looks like this:

```ts
import semanticRelease, { getLogger, resolveConfig, resolveEnvCi } from "@semantic-release/core";

const cwd = process.cwd();
const env = process.env;
const envCi = resolveEnvCi({ cwd, env });
const logger = getLogger({ stdout: process.stdout, stderr: process.stderr });

// Optional: override defaults applied by core.
Object.assign(env, {
  GIT_AUTHOR_NAME: "semantic-release-bot",
  GIT_AUTHOR_EMAIL: "semantic-release-bot@example.com",
  GIT_COMMITTER_NAME: "semantic-release-bot",
  GIT_COMMITTER_EMAIL: "semantic-release-bot@example.com",
  ...env,
  GIT_ASKPASS: "echo",
  GIT_TERMINAL_PROMPT: 0,
});

const context = {
  cwd,
  env,
  envCi,
  logger,
  stdout: process.stdout,
  stderr: process.stderr,
};
const runtimeOptions = { dryRun: true };

const { options, plugins } = await resolveConfig(context, runtimeOptions, {
  buildPlugins: true,
  baseConfig: { branches: ["main"] },
});

await semanticRelease({
  context: { ...context, options },
  plugins,
});
```
