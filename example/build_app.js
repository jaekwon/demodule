#!/usr/bin/env node

var demodule = require("demodule");

var dependencies = [
    // the entrypoint, a single file.
    {name:"__main__", path:"./main.js"},

    // a library from NPM
    {name:"underscore", path:"./node_modules/underscore/underscore.js"},

    // a whole directory, recursively.
    {name:"lib", path:"./lib"},

    // another whole directory
    {name:"foo", path:"./foo"},
];

// package all the files into a string
demodule(dependencies, {minify: false, debug:true, output:"build/app.js"});
