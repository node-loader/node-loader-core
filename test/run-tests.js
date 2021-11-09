import Mocha from "mocha";

const mocha = new Mocha();

mocha.addFile("./test/resolve.test.js");
mocha.addFile("./test/load.test.js");

mocha.loadFilesAsync().then(() => {
  mocha.run();
});
