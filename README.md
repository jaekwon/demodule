# Demodule
_CommonJS for the browser!_

A simple tool to package javascript files into one using CommonJS module specification.<br/>

* Explicitly define which files to include
* Recursive require() support
* Minimization
* Great for structuring client-side code

## Example

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

// this gets called by the entry code passed to demodule().
exports.run = function() { 
    console.log(rand.randId(12));
}; 
```

Check out the [full example](https://github.com/jaekwon/demodule/tree/master/example).
 
### Entry Code

The second argument to `demodule()` is the entry code. This is the snippet of code that gets run when the file is loaded on the browser.

Here's a more advanced version:

```javascript
// This function gets serialized into a string.
// This is just a convenient way to write the entry code.
function entryFunction() {
    console.log("Hello world!");

    // Some libraries require the 'global' variable.
    global = window;

    // Expose the 'require' function for client-side debugging.
    window.require = require;

    // Run the main application code.
    require("app").run();
}
var entry = '('+entryFunction+')();';

// package all the files into a string
var code = demodule(dependencies, entry, options);
```

## FAQ

__How does this compare to Browserify?__

Browserify has a lot of magic to bring node.js server-side code over to the browser environment. This is a much simpler tool that gives you more control.<br/>
Also, if two NPM libraries import different versions of another library, Browserify handles that by automatically packaging all of them. This tool doesn't.

__Why isn't there a command-line tool?__

You need to declare the dependencies in a file anyways, so you might as well edit the build script, which is simple.

__How do I add dependencies from NPM?__

Just call `npm install packageName`, or add it into your `package.json`'s dependency list as normal.<br/>
Then, find the javascript files (or folders) you want to include and add them to your build script.<br/>
This tool doesn't automatically add sub-dependencies from NPM libraries -- you need to locate them yourself.

## Installation

Requires NodeJS.

See the [example app](https://github.com/jaekwon/demodule/tree/master/example) for usage.
