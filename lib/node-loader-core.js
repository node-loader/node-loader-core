import path from "path";

const configPath = path.join(
  process.cwd(),
  process.env.NODE_LOADER_CONFIG || "node-loader.config.js"
);

let configPromise = import(configPath).then(
  (ns) => {
    const config = ns.default;
    return processConfig(config);
  },
  (err) => {
    die(`Could not read node-loader.config.js file at ` + configPath, err);
  }
);

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

// export const getFormat = createHook("getFormat")

// export const getSource = createHook("getSource")

// export const transformSource = createHook("transformSource")

// export const getGlobalPreloadCode = createHook("getGlobalPreloadCode", false)

// export const dynamicInstantiate = createHook("dynamicInstantiate")

global.nodeLoader = global.nodeLoader || {};
global.nodeLoader.setConfigPromise = function setConfigPromise(newConfig) {
  console.log("setting config", newConfig);
  configPromise = newConfig.then((config) => {
    config.resolvedLoaders = resolveLoaders(config);
  });
};

function createHook(name) {
  return async function (...args) {
    console.log("NLC", name, args[0]);
    const config = await configPromise;
    const { resolvedLoaders } = config;
    const hook = resolvedLoaders[name];
    return hook(...args);
  };
}

function resolveLoaders(config) {
  return {
    resolve: flattenSequentialLoaders(config, "resolve"),
    getFormat: flattenSequentialLoaders(config, "getFormat"),
    getSource: flattenSequentialLoaders(config, "getSource"),
    transformSource: flattenSequentialLoaders(config, "transformSource"),
    getGlobalPreloadCode: function getGlobalPreloadCode() {
      return getLoaders(config, "getGlobalPreloadCode").reduce(
        (result, loader) => {
          return result + loader() + ";";
        },
        ""
      );
    },
    dynamicInstantiate: flattenSequentialLoaders(config, "dynamicInstantiate"),
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
