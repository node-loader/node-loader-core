import path from "path";

let configPromise;

const configPath = path.join(
  process.cwd(),
  process.env.NODE_LOADER_CONFIG || "node-loader.config.js"
);

let readConfigFile = false;
let loadingConfig = true;

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

export const getFormat = createHook("getFormat");

export const getSource = createHook("getSource");

export const transformSource = createHook("transformSource");

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
  if (!readConfigFile && !configPromise) {
    readConfigFile = true;
    configPromise = import(configPath).then(
      (ns) => {
        loadingConfig = false;
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
    );
  }

  return configPromise;
}

function createHook(name) {
  return async function (...args) {
    if (loadingConfig) {
      getConfigPromise();
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
    getFormat: flattenSequentialLoaders(config, "getFormat"),
    getSource: flattenSequentialLoaders(config, "getSource"),
    transformSource: flattenSequentialLoaders(config, "transformSource"),
    // getGlobalPreloadCode not currently supported
    // getGlobalPreloadCode: function getGlobalPreloadCode() {
    //   return getLoaders(config, "getGlobalPreloadCode").reduce(
    //     (result, loader) => {
    //       return result + loader() + ";";
    //     },
    //     ""
    //   );
    // },
  };
}

function getLoaders(config, name) {
  return config.loaders
    .filter((loader) => loader[name])
    .map((loader) => loader[name]);
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
    return impl(...args, nextImpl);
  };
}
