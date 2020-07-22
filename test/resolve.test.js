import assert from "assert";
// import yoshi from './fixtures/yoshi.js'
// import emptyConfig from './node-loader.config.js'

describe("resolve hook", () => {
  // it(`uses default resolution with no resolve hooks provided`, async () => {
  //   const ns = await import('./fixtures/pi.js')
  //   assert.equal(ns.default, Math.PI)
  // })

  it(`works with a single resolve hook`, async () => {
    // global.nodeLoader.setConfigPromise(Promise.resolve({
    //   loaders: [
    //     {
    //       resolve: async function(specifier, context, defaultResolve) {
    //         const { parentURL = null } = context

    //         console.log('custom resolve:', specifier)

    //         if (specifier === "yoshi") {
    //           return {
    //             url: new URL("./fixtures/yoshi.js", parentURL)
    //           }
    //         } else {
    //           return defaultResolve(specifier, context)
    //         }
    //       }
    //     }
    //   ]
    // }))

    console.log("importing yoshi with relative path");

    const ns = await import("./fixtures/yoshi.js");
    assert.equal(
      ns.default,
      "Yoshi doesn't deserve to be subservient to Mario"
    );

    console.log("importing yoshi with bare specifier");

    const ns2 = await import("yoshi");
    assert.equal(ns2, ns);
  });
});
