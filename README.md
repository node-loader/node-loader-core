# @node-loader/core

A configurable NodeJS loader that combines multiple other loaders into one. Only works with 

## Deprecation Notice

As of NodeJS 20, combining multiple loaders into one loader is possible via [chaining with the `--import` flag](https://nodejs.org/docs/latest-v20.x/api/module.html#chaining). It is recommended to switch to native NodeJS chaining.

## Motivation

[NodeJS Loaders](https://nodejs.org/dist/latest-v14.x/docs/api/esm.html#esm_experimental_loaders) are a new feature that allow you to configure the behavior of modules loaded with `import` or `import()`. NodeJS currently only allows you to specify a single loader when starting up Node. However, the `@node-loader/core` project allows you to combine multiple into a single loader through a configuration file.

## Installation

```sh
npm install --save @node-loader/core
```

For NodeJS@<16.12, use `@node-loader/core@1`. For NodeJS@>=16.12 but <20, use `@node-loader/core@latest`. For Node >=20, use [`--import` chaining](https://nodejs.org/docs/latest-v20.x/api/module.html#chaining)

## Usage

Create a file `node-loader.config.js` in your current working directory:

```js
import * as importMapLoader from "@node-loader/import-maps";
import * as httpLoader from "@node-loader/http";

export default {
  loaders: [importMapLoader, httpLoader],
};
```

Then run node with the `--experimental-loader` flag:

```sh
node --experimental-loader @node-loader/core file.js
```

Your code will now run with all loaders specified in the configuration file, merged into a single loader. When multiple loaders specify the same loader hook (such as `resolve`), they will be called sequentially until one of them returns a non-default value. The order in which they are called is the same order specified in the configuration file.

## Configuration

By default, node-loader core looks for a configuration file called `node-loader.config.js` in the current working directory. To specify the file path to the configuration file, provide the `NODE_LOADER_CONFIG` environment variable:

```sh
NODE_LOADER_CONFIG=/Users/name/some/dir/node-loader.config.js --experimental-loader @node-loader/core file.js
```

Within the file, only the `loaders` property is currently respected. In the future, additional configuration options may be defined.
