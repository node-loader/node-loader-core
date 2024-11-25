import assert from "assert";

describe("resolve hook", () => {
  it(`works with a single resolve hook`, async () => {
    global.nodeLoader.setConfigPromise(
      Promise.resolve({
        loaders: [
          {
            resolve: async function (specifier, context, defaultResolve) {
              const { parentURL = null } = context;

              if (specifier === "yoshi") {
                return {
                  url: new URL("./fixtures/yoshi.js", parentURL).href,
                };
              } else {
                return defaultResolve(specifier, context);
              }
            },
          },
        ],
      })
    );

    const ns = await import("./fixtures/yoshi.js");
    assert.equal(
      ns.default,
      "Yoshi doesn't deserve to be subservient to Mario"
    );

    const ns2 = await import("yoshi");
    assert.equal(ns2, ns);
  });

  it(`works with multiple resolve hooks`, async () => {
    global.nodeLoader.setConfigPromise(
      Promise.resolve({
        loaders: [
          {
            resolve: async function (specifier, context, defaultResolve) {
              const { parentURL = null } = context;

              if (specifier === "donkeykong") {
                return {
                  url: new URL("./fixtures/donkeykong-1.js", parentURL).href,
                };
              } else if (specifier === "luigi") {
                return {
                  url: new URL("./fixtures/luigi-1.js", parentURL).href,
                };
              } else {
                return defaultResolve(specifier, context);
              }
            },
          },
          {
            resolve: async function (specifier, context, defaultResolve) {
              const { parentURL = null } = context;

              if (specifier === "luigi") {
                return {
                  url: new URL("./fixtures/luigi-2.js", parentURL).href,
                };
              } else if (specifier === "captainfalcon") {
                return {
                  url: new URL("./fixtures/captainfalcon-2.js", parentURL).href,
                };
              } else {
                return defaultResolve(specifier, context);
              }
            },
          },
        ],
      })
    );

    const dk = await import("donkeykong");
    assert.equal(dk.default, "Donkey Kong 1");

    const luigi = await import("luigi");
    assert.equal(luigi.default, "Luigi 1");

    const captainFalcon = await import("captainfalcon");
    assert.equal(captainFalcon.default, "Captain Falcon 2");
  });

  it(`supports passing down options to resolve hook`, async () => {
    global.nodeLoader.setConfigPromise(
      Promise.resolve({
        loaders: [
          {
            options: {
              nocache: true,
            },
            loader: {
              resolve: async function (
                specifier,
                context,
                defaultResolve,
                loaderOptions
              ) {
                const { parentURL = null } = context;

                if (specifier === "yoshi-2") {
                  const url = new URL("./fixtures/yoshi-2.js", parentURL).href;

                  return {
                    url: loaderOptions?.nocache
                      ? url + `?${Math.random()}`
                      : url,
                  };
                } else {
                  return defaultResolve(specifier, context);
                }
              },
            },
          },
        ],
      })
    );

    const ns = await import("yoshi-2");
    assert.equal(
      ns.default,
      "Yoshi doesn't deserve to be subservient to Mario"
    );

    const ns2 = await import("yoshi-2");
    assert.notEqual(ns2, ns);
  });
});
