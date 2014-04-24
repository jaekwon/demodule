# Demodule
_CommonJS for the browser!_

A simple tool to package javascript files into one using CommonJS module specification.<br/>

* Explicitly define which files to include
* Recursive require() support
* Minimization
* Great for structuring client-side code

## Example

You can see the full example in the [example](https://github.com/jaekwon/demodule/tree/master/example) folder.

First, define a build script in the root of your JS source folder that includes all of your dependencies.

```javascript
// build_app.js

var demodule = require("demodule");

var dependencies = [
    // a single file
    {name:"app", path:"./app.js"},

    // a library from NPM
    {name:"underscore", path:"./node_modules/underscore/underscore.js"},

    // a whole directory, recursively.
    {name:"lib", path:"./lib"},
];

// this gets run when the browser loads the file.
var entry = 'require("app").run();';

// package all the files into a string
var code = demodule(dependencies, entry, {minify: false, debug:true});

// write the string to a file
var err = require("fs").writeFileSync("build/app.js", code);

if (err) { throw(err); }
```

Then, use `require()` in your code to import modules.

```javascript
// app.js

var rand = require("lib/rand");

// this gets called by the entry code passed to demodule.
exports.run = function() { 
    console.log(rand.randId(12));
}; 
```

## Installation

Requires NodeJS.

See the [example app](https://github.com/jaekwon/demodule/tree/master/example) for usage.
