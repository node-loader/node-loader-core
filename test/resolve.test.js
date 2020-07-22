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
});
