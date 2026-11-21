import { castArray, identity, isArray, isFunction, isNil, isPlainObject, isString, omit } from "lodash-es";
import AggregateError from "aggregate-error";
import getError from "../get-error.js";
import PLUGINS_DEFINITIONS from "../definitions/plugins.js";
import { loadPlugin, parseConfig, validatePlugin, validateStep } from "./utils.js";
import pipeline from "./pipeline.js";
import normalize from "./normalize.js";
import { DEFAULT_ANALYZE_COMMITS_PLUGIN } from "../definitions/constants.js";

export default async (context, pluginsPath) => {
  let { options, logger } = context;
  const errors = [];

  const plugins = options.plugins
    ? await castArray(options.plugins).reduce(async (eventualPluginsList, plugin) => {
        const pluginsList = await eventualPluginsList;
        if (validatePlugin(plugin)) {
          const [name, config] = parseConfig(plugin);
          plugin = isString(name) ? await loadPlugin(context, name, pluginsPath) : name;

          if (isPlainObject(plugin)) {
            Object.entries(plugin).forEach(([type, func]) => {
              if (PLUGINS_DEFINITIONS[type]) {
                Reflect.defineProperty(func, "pluginName", {
                  value: isPlainObject(name) ? "Inline plugin" : name,
                  writable: false,
                  enumerable: true,
                });
                pluginsList[type] = [...(pluginsList[type] || []), [func, config]];
              }
            });
          } else {
            errors.push(getError("EPLUGINSCONF", { plugin }));
          }
        } else {
          errors.push(getError("EPLUGINSCONF", { plugin }));
        }

        return pluginsList;
      }, {})
    : [];

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  options = { ...plugins, ...options };

  // Inject @semantic-release/commit-analyzer as fallback for analyzeCommits when:
  // - No plugin in the plugins list covers the analyzeCommits step.
  // - No explicit step-level plugin spec is set for analyzeCommits.
  // An options-only plain object without a `path` field is treated as step configuration
  // to merge into the injected fallback, not as a plugin spec itself.
  if (!plugins.analyzeCommits) {
    const analyzeCommitsStepConfig = options.analyzeCommits;
    const isPluginSpec =
      !isNil(analyzeCommitsStepConfig) &&
      (isString(analyzeCommitsStepConfig) ||
        isFunction(analyzeCommitsStepConfig) ||
        isArray(analyzeCommitsStepConfig) ||
        (isPlainObject(analyzeCommitsStepConfig) && !isNil(analyzeCommitsStepConfig.path)));

    if (!isPluginSpec) {
      const mergeOptions = isPlainObject(analyzeCommitsStepConfig) ? analyzeCommitsStepConfig : {};
      try {
        const fallbackPlugin = await loadPlugin(context, DEFAULT_ANALYZE_COMMITS_PLUGIN, pluginsPath);
        if (isPlainObject(fallbackPlugin) && isFunction(fallbackPlugin.analyzeCommits)) {
          Reflect.defineProperty(fallbackPlugin.analyzeCommits, "pluginName", {
            value: DEFAULT_ANALYZE_COMMITS_PLUGIN,
            writable: false,
            enumerable: true,
          });
          options.analyzeCommits = [[fallbackPlugin.analyzeCommits, mergeOptions]];
        }
      } catch (error) {
        if (logger && isFunction(logger.warn)) {
          logger.warn(
            'Could not load fallback plugin "%s" for analyzeCommits: %s',
            DEFAULT_ANALYZE_COMMITS_PLUGIN,
            error.message
          );
        }
        // DEFAULT_ANALYZE_COMMITS_PLUGIN is unavailable; fall through to EMISSINGREQUIREDPLUGIN.
      }
    }
  }

  const pluginsConfig = await Object.entries(PLUGINS_DEFINITIONS).reduce(
    async (
      eventualPluginsConfigAccumulator,
      [type, { required, default: def, pipelineConfig, postprocess = identity, preprocess = identity }]
    ) => {
      let pluginOptions;
      const pluginsConfigAccumulator = await eventualPluginsConfigAccumulator;

      if (isNil(options[type]) && def) {
        pluginOptions = def;
      } else {
        if (required && isNil(options[type])) {
          errors.push(getError("EMISSINGREQUIREDPLUGIN", { type }));
          return pluginsConfigAccumulator;
        }

        // If an object is passed and the path is missing, merge it with step options
        if (isPlainObject(options[type]) && !options[type].path) {
          options[type] = castArray(plugins[type]).map((plugin) =>
            plugin ? [plugin[0], Object.assign(plugin[1], options[type])] : plugin
          );
        }

        if (!validateStep({ required }, options[type])) {
          errors.push(getError("EPLUGINCONF", { type, required, pluginConf: options[type] }));
          return pluginsConfigAccumulator;
        }

        pluginOptions = options[type];
      }

      const steps = await Promise.all(
        castArray(pluginOptions).map(async (pluginOpt) =>
          normalize(
            { ...context, options: omit(options, Object.keys(PLUGINS_DEFINITIONS), "plugins") },
            type,
            pluginOpt,
            pluginsPath
          )
        )
      );

      pluginsConfigAccumulator[type] = async (input) =>
        postprocess(
          await pipeline(
            steps,
            pipelineConfig && pipelineConfig(pluginsConfigAccumulator, logger)
          )(await preprocess(input)),
          input
        );

      return pluginsConfigAccumulator;
    },
    plugins
  );
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  return pluginsConfig;
};
