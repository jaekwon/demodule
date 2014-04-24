#!/usr/bin/env node

var demodule = require("demodule");

var dependencies = [
    // a single file
    {name:"app", path:"./app.js"},

    // a library from NPM
    {name:"underscore", path:"./node_modules/underscore/underscore.js"},

    // a whole directory, recursively.
    {name:"lib", path:"./lib"},

    // another whole directory
    {name:"foo", path:"./foo"},
];

// this gets run when the browser loads the file.
var entry = 'require("app").run();';

// package all the files into a string
var code = demodule(dependencies, entry, {minify: false, debug:true});

// write the string to a file
var err = require("fs").writeFileSync("build/app.js", code);

if (err) { throw(err); }
