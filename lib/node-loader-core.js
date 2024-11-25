import path from "path";
import url from "url";

let configPromise;

let configPath;

if (
  process.env.NODE_LOADER_CONFIG &&
  path.isAbsolute(process.env.NODE_LOADER_CONFIG)
) {
  configPath = url.pathToFileURL(process.env.NODE_LOADER_CONFIG);
} else {
  configPath = url.pathToFileURL(
    path.join(
      process.cwd(),
      process.env.NODE_LOADER_CONFIG || "node-loader.config.js"
    )
  );
}

let loadingConfig = false;

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

function die(msg, err) {
  console.error(msg);
  if (err) {
    console.error(err);
  }
  process.exit(1);
}

export const resolve = createHook("resolve");

export const load = createHook("load");

// getGlobalPreloadCode is synchronous, which means we can't import the config file in time :'(
// export const getGlobalPreloadCode = createHook("getGlobalPreloadCode")

global.nodeLoader = global.nodeLoader || {};
global.nodeLoader.setConfigPromise = function setConfigPromise(newConfig) {
  configPromise = newConfig.then((config) => {
    config.resolvedLoaders = resolveLoaders(config);
    return config;
  });
};

function getConfigPromise() {
  if (!configPromise) {
    loadingConfig = true;
    configPromise = import(configPath)
      .then(
        (ns) => {
          const config = ns.default;
          return processConfig(config);
        },
        (err) => {
          console.warn(
            `Could not read node-loader.config.js file at ${configPath}, continuing without node loader config`
          );
          console.error(err);
          return processConfig({ loaders: [] });
        }
      )
      .finally(() => {
        loadingConfig = false;
      });
  }

  return configPromise;
}

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

function resolveLoaders(config) {
  return {
    resolve: flattenSequentialLoaders(config, "resolve"),
    load: flattenSequentialLoaders(config, "load"),
  };
}

function getLoaders(config, name) {
  return config.loaders
    .filter((loader) => (loader.loader ? loader.loader[name] : loader[name]))
    .map((loader) =>
      loader.loader
        ? (...args) => {
            return loader.loader[name].apply(this, args.concat(loader.options));
          }
        : loader[name]
    );
}

function flattenSequentialLoaders(config, name) {
  const loaders = getLoaders(config, name);

  return async function (...args) {
    const hookArgs = args.slice(0, args.length - 1);
    const defaultImplementation = args[args.length - 1];

    const impl = constructImpl(loaders, 0, defaultImplementation);
    return impl(...hookArgs);
  };
}

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
