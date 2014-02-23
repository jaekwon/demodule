exports.name = "foo";

var bar = require("./bar");

console.log("[foo] someglobal:", someglobal);

module.exports = {
    name: "FOO"
};
