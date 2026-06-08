import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { castArray, isNil, isPlainObject, isString, pickBy } from "lodash-es";
import { readPackageUp } from "read-package-up";
import { cosmiconfig } from "cosmiconfig";
import importFrom from "import-from-esm";
import debugConfig from "debug";
import { repoUrl } from "./git.js";
import PLUGINS_DEFINITIONS from "./definitions/plugins.js";
import plugins from "./plugins/index.js";
import { parseConfig, validatePlugin } from "./plugins/utils.js";
import { DEFAULT_ANALYZE_COMMITS_PLUGIN } from "./definitions/constants.js";

const debug = debugConfig("semantic-release:config");
const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG_NAME = "release";

/**
 * @todo make config external option input agnostic, `cliOptions` niches input down to CLIs only
 */
export default async (context, cliOptions, { buildPlugins = false, baseConfig } = {}) => {
  const { cwd, env } = context;
  const { config, filepath } = (await cosmiconfig(CONFIG_NAME).search(cwd)) || {};

  debug("load config from: %s", filepath);

  // Merge base config, config file options and CLI/API options
  const resolvedBaseConfig = await resolveBaseConfig(cwd, baseConfig);
  let options = { ...resolvedBaseConfig, ...config, ...cliOptions };

  const pluginsPath = {};
  let extendPaths;
  ({ extends: extendPaths, ...options } = options);
  if (extendPaths) {
    // If `extends` is defined, load and merge each shareable config with `options`
    options = {
      ...(await castArray(extendPaths).reduce(async (eventualResult, extendPath) => {
        const result = await eventualResult;
        const extendsOptions = (await importFrom.silent(__dirname, extendPath)) || (await importFrom(cwd, extendPath));

        // For each plugin defined in a shareable config, save in `pluginsPath` the extendable config path,
        // so those plugin will be loaded relative to the config file
        Object.entries(extendsOptions)
          .filter(([, value]) => Boolean(value))
          .reduce((pluginsPath, [option, value]) => {
            castArray(value).forEach((plugin) => {
              if (option === "plugins" && validatePlugin(plugin)) {
                pluginsPath[parseConfig(plugin)[0]] = extendPath;
              } else if (
                PLUGINS_DEFINITIONS[option] &&
                (isString(plugin) || (isPlainObject(plugin) && isString(plugin.path)))
              ) {
                pluginsPath[isString(plugin) ? plugin : plugin.path] = extendPath;
              }
            });
            return pluginsPath;
          }, pluginsPath);

        return { ...result, ...extendsOptions };
      }, {})),
      ...options,
    };
  }

  // Set default options values if not defined yet
  options = {
    branches: [
      "+([0-9])?(.{+([0-9]),x}).x",
      "master",
      "main",
      "next",
      "next-major",
      { name: "beta", prerelease: true },
      { name: "alpha", prerelease: true },
    ],
    repositoryUrl: (await pkgRepoUrl({ normalize: false, cwd })) || (await repoUrl({ cwd, env })),
    tagFormat: `v\${version}`,
    plugins: [DEFAULT_ANALYZE_COMMITS_PLUGIN],
    // Remove `null` and `undefined` options, so they can be replaced with default ones
    ...pickBy(options, (option) => !isNil(option)),
    ...(options.branches ? { branches: castArray(options.branches) } : {}),
  };

  if (options.ci === false) {
    options.noCi = true;
  }

  debug("options values: %O", options);

  return {
    options,
    plugins: buildPlugins ? await plugins({ ...context, options }, pluginsPath) : undefined,
  };
};

async function resolveBaseConfig(cwd, baseConfig) {
  if (isNil(baseConfig)) {
    return {};
  }

  if (isString(baseConfig)) {
    const loaded = (await importFrom.silent(__dirname, baseConfig)) || (await importFrom(cwd, baseConfig));
    return loaded && isPlainObject(loaded.default) ? loaded.default : loaded;
  }

  if (isPlainObject(baseConfig)) {
    return baseConfig;
  }

  throw new TypeError("configOptions.baseConfig must be a file path or a plain object");
}

async function pkgRepoUrl(options) {
  const { packageJson } = (await readPackageUp(options)) || {};
  return packageJson && (isPlainObject(packageJson.repository) ? packageJson.repository.url : packageJson.repository);
}