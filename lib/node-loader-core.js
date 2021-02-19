import path from "path";
import url from "url";

/**
 * @callback resolve - ESM resolve() loader hook
 * @param {string} specifier
 * @param {{
 *   conditions: !Array<string>,
 *   parentURL: !(string | undefined),
 * }} context
 * @param {Function} defaultResolve
 * @returns {Promise<{ url: string }>}
 */

/**
 * @callback getFormat - ESM getformat() loader hook
 * @param {string} url
 * @param {Object} context (currently empty)
 * @param {Function} defaultGetFormat
 * @returns {Promise<{ format: string }>}
 */

/**
 * @callback getSource - ESM getSource() loader hook
 * @param {string} url
 * @param {{ format: string }} context
 * @param {Function} defaultGetSource
 * @returns {Promise<{ source: !(string | SharedArrayBuffer | Uint8Array) }>}
 */

/**
 * @callback transformSource - ESM transformSource() loader hook
 * @param {!(string | SharedArrayBuffer | Uint8Array)} source
 * @param {{
 *   format: string,
 *   url: string,
 * }} context
 * @param {Function} defaultTransformSource
 * @returns {Promise<{ source: !(string | SharedArrayBuffer | Uint8Array) }>}
 */

/** @typedef {resolve|getFormat|getSource|transformSource} LoaderHook */

/** @typedef {"resolve"|"getFormat"|"getSource"|"transformSource"} LoaderHookName */

/** @typedef {Partial<Record<LoaderHookName, LoaderHook>>} LoaderDefinition */

/** @typedef {Promise<LoaderDefinition>} ConfigPromise */

/** @typedef {{loaders: Array<LoaderDefinition>}} Config */

let configPromise;

/**
 * `true` while attempting to import(configPath)
 * @see getConfigPromise
 */
let loadingConfig = false;

function die(msg, err) {
  console.error(msg);
  if (err) {
    console.error(err);
  }
  process.exit(1);
}

/**
 * Return a supported ESM loader hook appropriate for export.
 *
 * @param {"resolve"|"getFormat"|"getSource"|"transformSource"} name - Valid ESM loader hook name
 * @returns {LoaderHook} - The final composed definition for hook type "name"
 */
function createHook(name) {
  return async function (...args) {
    if (loadingConfig) {
      const defaultImpl = args[args.length - 1];
      return defaultImpl(...args);
    } else {
      const config = await getConfigPromise();
      const { resolvedLoaders } = config;
      const hook = resolvedLoaders[name];
      return hook(...args);
    }
  };
}

/**
 * Directly supply a config (no config file) to produce a
 * resolved loaders definition. Used only for tests.
 *
 * @param {ConfigPromise} newConfig
 */
function setConfigPromise(newConfig) {
  configPromise = newConfig.then((config) => {
    config.resolvedLoaders = resolveLoaders(config);
    return config;
  });
}

/**
 * Used to await async import and resolution of the config.
 *
 * @returns {Promise<LoaderDefinition>}
 */
function getConfigPromise() {
  const configPath = getConfigPath();

  if (!configPromise) {
    loadingConfig = true;
    configPromise = import(configPath)
      .then(
        (ns) => {
          const config = ns.default;
          return processConfig(config);
        },
        (error) => {
          console.warn(
            `Could not read node-loader.config.js file at ${configPath}, continuing without node loader config`
          );
          // Swallow error and return an empty implementation
          return processConfig({ loaders: [] });
        }
      )
      .finally(() => {
        loadingConfig = false;
      });
  }

  return configPromise;
}

/**
 * Resolve the location from which to import() the config file.
 *
 * @returns {url.URL} - A file:// url
 */
function getConfigPath() {
  if (
    process.env.NODE_LOADER_CONFIG &&
    path.isAbsolute(process.env.NODE_LOADER_CONFIG)
  ) {
    return url.pathToFileURL(process.env.NODE_LOADER_CONFIG);
  }

  return url.pathToFileURL(
    path.join(
      process.cwd(),
      process.env.NODE_LOADER_CONFIG || "node-loader.config.js"
    )
  );
}

/**
 * Perform validation of config before resolving flattened loaders definition.
 *
 * @param {Config} config
 * @returns {ReturnType<resolveLoaders>}
 */
function processConfig(config) {
  if (typeof config !== "object") {
    die(
      `node-loader.config.js: did not export a config object as default export.`
    );
  }

  if (!Array.isArray(config.loaders)) {
    die(
      `node-loader.config.js: exported object does not include a "loaders" array`
    );
  }

  config.loaders.forEach((loader, i) => {
    if (typeof loader !== "object") {
      die(
        `node-loader.config.js: Invalid loader at index ${i} - expected object but received ${typeof loader}`
      );
    }

    if (Array.isArray(loader)) {
      die(
        `node-loader.config.js: Invalid loader at index ${i} - expected plain object but received Array`
      );
    }
  });

  config.resolvedLoaders = resolveLoaders(config);

  return config;
}

/**
 * Produce the final flattened loaders definition.
 *
 * @param {Config} config
 * @returns {LoaderDefinition} - An object whose keys are hook names and values hook functions
 */
function resolveLoaders(config) {
  return {
    resolve: flattenSequentialLoaders(config, "resolve"),
    getFormat: flattenSequentialLoaders(config, "getFormat"),
    getSource: flattenSequentialLoaders(config, "getSource"),
    transformSource: flattenSequentialLoaders(config, "transformSource"),
    // getGlobalPreloadCode is synchronous, which means we can't import the config file in time :'(
  };
}

/**
 * Produce the final flattened definition for a single loader.
 *
 * @param {Config} config - The node-loader-core config
 * @param {LoaderHookName} name - A valid ESM loader hook name
 * @returns {Promise<LoaderHook>}
 */
function flattenSequentialLoaders(config, name) {
  const loaders = getLoaders(config, name);

  return async function (...args) {
    const hookArgs = args.slice(0, args.length - 1);
    const defaultImplementation = args[args.length - 1];

    const impl = constructImpl(loaders, 0, defaultImplementation);
    return impl(...hookArgs);
  };
}

/**
 * Collect an array of loaders of the same type/name, in the order
 * they were supplied in the config.
 *
 * @param {Config} config - The node-loader-core config
 * @param {LoaderHookName} name - A valid ESM loader hook name
 * @returns {Array<LoaderHook>}
 */
function getLoaders(config, name) {
  return config.loaders
    .filter((loader) => loader[name])
    .map((loader) => loader[name]);
}

/**
 * Compose several loaders specified in the config into one, in which
 * each loader is called in sequence until one returns a non-default value.
 *
 * @param {Array<LoaderHook>} loaders - An array of loader hooks of the same type
 * @param {number} index - The index of the current loader hook being executed
 * @param {LoaderHook} defaultImplementation - Default loader hook implementation by Node.js
 */
function constructImpl(loaders, index, defaultImplementation) {
  return async function (...args) {
    const impl = loaders[index] || defaultImplementation;
    const nextImpl = constructImpl(loaders, index + 1, defaultImplementation);
    if (typeof args[args.length - 1] === "function") {
      args.pop();
    }
    return impl(...args, nextImpl);
  };
}

// Final resolved hook implementations: https://nodejs.org/api/esm.html#esm_hooks
export const resolve = createHook("resolve");
export const getFormat = createHook("getFormat");
export const getSource = createHook("getSource");
export const transformSource = createHook("transformSource");
// getGlobalPreloadCode is synchronous, which means we can't import the config file in time :'(

// Make tested methods accessible from `global`, rather than exported directly.
// Otherwise, the cyclic dependency of importing node-loader-core exports
// into test files results in the exports being undefined.
global.nodeLoader = global.nodeLoader || {
  setConfigPromise,
  getConfigPath,
};
