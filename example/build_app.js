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
