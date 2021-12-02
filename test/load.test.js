import assert from "assert";

describe("load hook", () => {
  it(`works with a single load hook`, async () => {
    global.nodeLoader.setConfigPromise(
      Promise.resolve({
        loaders: [
          {
            load: async function (url, context, defaultLoad) {
              if (url.includes("krool.js")) {
                const { source: originalSource } = await defaultLoad(
                  url,
                  context
                );
                const finalSource = `${originalSource};\nexport const more = "I mean what did he even do to deserve Donkey Kong's wrath?"`;
                return {
                  format: "module",
                  source: finalSource,
                };
              } else {
                return defaultLoad(url, context);
              }
            },
          },
        ],
      })
    );

    const ns = await import("./fixtures/krool.js");
    assert.equal(ns.default, "King K Rool might actually be a nice guy");

    assert.equal(
      ns.more,
      "I mean what did he even do to deserve Donkey Kong's wrath?"
    );
  });

  it(`works with multiple load hooks`, async () => {
    global.nodeLoader.setConfigPromise(
      Promise.resolve({
        loaders: [
          {
            load: async function (url, context, defaultLoad) {
              if (url.includes("krool2.js")) {
                const { source: originalSource } = await defaultLoad(
                  url,
                  context
                );
                const finalSource = `${originalSource};\nexport const more = "I mean what did he even do to deserve Donkey Kong's wrath?"`;
                return {
                  format: "module",
                  source: finalSource,
                };
              } else {
                return defaultLoad(url, context);
              }
            },
          },
          {
            load: async function (url, context, defaultLoad) {
              if (url.includes("krool2.js")) {
                const { source: originalSource } = await defaultLoad(
                  url,
                  context
                );
                const finalSource = `${originalSource};\nexport const evenMore = "What if we got it all wrong and DK is the evil one?"`;
                return {
                  format: "module",
                  source: finalSource,
                };
              } else {
                return defaultLoad(url, context);
              }
            },
          },
        ],
      })
    );

    const ns = await import("./fixtures/krool2.js");
    assert.equal(ns.default, "King K Rool might actually be a nice guy");

    assert.equal(
      ns.more,
      "I mean what did he even do to deserve Donkey Kong's wrath?"
    );

    assert.equal(
      ns.evenMore,
      "What if we got it all wrong and DK is the evil one?"
    );
  });

  it(`supports passing down options to load hook`, async () => {
    global.nodeLoader.setConfigPromise(
      Promise.resolve({
        loaders: [
          {
            options: {
              capitalize: true,
            },
            loader: {
              load: async function (url, context, defaultLoad, loaderOptions) {
                if (url.includes("krool3.js")) {
                  const { source: originalSource } = await defaultLoad(
                    url,
                    context
                  );

                  let str =
                    "I mean what did he even do to deserve Donkey Kong's wrath?";

                  if (loaderOptions?.capitalize) {
                    str = str.toUpperCase();
                  }

                  const finalSource = `${originalSource};\nexport const more = "${str}"`;
                  return {
                    format: "module",
                    source: finalSource,
                  };
                } else {
                  return defaultLoad(url, context);
                }
              },
            },
          },
        ],
      })
    );

    const ns = await import("./fixtures/krool3.js");
    assert.equal(ns.default, "King K Rool might actually be a nice guy");

    assert.equal(
      ns.more,
      "I mean what did he even do to deserve Donkey Kong's wrath?".toUpperCase()
    );
  });
});
