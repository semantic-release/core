# @semantic-release/core

`@semantic-release/core` is the composable release engine behind `semantic-release`.
It owns orchestration, config resolution, branch validation, plugin execution, and git interactions, while leaving CLI parsing and wrapper defaults to higher-level packages.

Use this package when you want to build a custom release workflow, compose your own CLI, or run semantic-release with an explicit plugin stack.

## Installation

```bash
npm install @semantic-release/core
```

## Public API

The package exports four public entry points:

- `default`: run a release with an explicit execution context and plugin input.
- `resolveConfig(context, runtimeOptions?, configOptions?)`: resolve configuration and, when requested, build the plugin pipeline.
- `getLogger({ stdout, stderr })`: create the logger used by semantic-release.
- `resolveEnvCi({ env?, cwd? })`: resolve CI metadata for the current environment.

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
  dryRun: true
};

const { options } = await resolveConfig(context, runtimeOptions, {
  buildPlugins: false,
});

const result = await semanticRelease({
  context: { ...context, options },
  plugins: ["@semantic-release/commit-analyzer"],
});
```

In the direct-composition path, the plugin list passed to core is the plugin source. `options.plugins` from config or shareable-config `extends` is not used as a fallback source for plugin loading.

## Core contract

The default export expects an object with:

- `context`: a release context that must include `context.options`.
- `plugins`: the explicit plugin input for the run.
- `onInit?`: an optional hook that runs before plugin normalization.

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

## Dependency and ownership model

`@semantic-release/core` does not own CLI parsing or wrapper defaults.

- Core owns the release engine and config-resolution API.
- Core expects callers to provide plugins explicitly.
- Wrapper packages can layer default plugins, CLI flags, or output formatting on top of core.

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