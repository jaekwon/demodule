# Demodule - CommonJS for the browser!

A simple tool to package javascript files into one using CommonJS module specification.<br/>
If you want to structure your browser client code using CommonJS (like NodeJS's 'require()'), this is for you.

* Explicitly define which files to include
* Recursive require() support
* Minimization

## Example

This is a sample build script using Demodule.<br/>
You can see the full example in the `example` folder.

```javascript
var demodule = require("demodule");
var fs = require("fs");

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

var entry = 'require("app").run();';

var code = demodule(dependencies, entry, {minify: false, debug:true});

var err = fs.writeFileSync("build/app.js", code);

if (err) { throw(err); }
```

## Installation

Requires NodeJS.

See the example app for usage.
