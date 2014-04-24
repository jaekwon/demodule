// rand is the exported namespace the 'lib/rand.js' file.
var rand = require("lib/rand");

// lib includes an index.js file, so this works too.
var lib = require("lib");

// here's a simple test.
var foo = require("foo");

// this gets called by the entry code passed to demodule.
exports.run = function() {
    console.log(rand.randId(12));   // some random junk
    console.log(rand == lib.rand);  // true
    console.log(foo.test());        // what does the fox say?
};
