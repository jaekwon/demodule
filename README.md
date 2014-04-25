# ![alt tag](https://github.com/jaekwon/demodule/raw/image/demodule.png)

A simple tool to package many javascript files into one.

* CommonJS module specification (`require()`) like NodeJS
* Control which files to include
* Recursive `require()` support
* Relative module paths support
* Great for structuring client-side code
* Minimization optional

## Example

First, define a build script in the root of your JS source folder that includes all of your dependencies.

```javascript
#!/usr/bin/env node
// build_app.js

var dependencies = [

    // the entrypoint, a single file.
    {name:"__main__", path:"./main.js"},

    // a library from NPM
    {name:"underscore", path:"./node_modules/underscore/underscore.js"},

    // a whole directory, recursively.
    {name:"lib", path:"./lib"},

];

// package all the files into a string
var demodule = require("demodule");
demodule(dependencies, {minify: false, debug:true, output:"build/app.js"});
```

Then, use `require()` in your code to import modules.

```javascript
// main.js

var rand = require("lib/rand");
console.log(rand.randId(12));
```

Check out the [full example](https://github.com/jaekwon/demodule/tree/master/example).
 
## FAQ

__How does this compare to Browserify?__

Browserify has a lot of magic to bring node.js server-side code over to the browser environment.<br/>
This is a much simpler tool that gives you more control.<br/>
For example, if two NPM libraries import different versions of another library, Browserify handles that by automatically packaging all of them.<br/>
This tool doesn't.

__Why isn't there a command-line tool?__

You need to declare the dependencies in a file anyways, so you might as well edit the build script.

__How do I add dependencies from NPM?__

Just call `npm install packageName`, or add it into your `package.json`'s dependency list as normal.<br/>
Then, find the javascript files (or folders) you want to include and add them to your build script.<br/>
This tool doesn't automatically add sub-dependencies from NPM libraries -- you need to locate them yourself.

## Installation

Requires NodeJS.

See the [example app](https://github.com/jaekwon/demodule/tree/master/example) for usage.
