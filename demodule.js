var glob = require("glob");
var ug = require("uglify-js");
var parser = ug.parser;
var uglify = ug.uglify;
var fs = require("fs");
require("sugar");

/*
    modules: An array of {name, path}
    'name' can contain slashes, but must not end in a slash.
    'path' is a file, directory, or glob.
    If 'path' is a directory, the entry file is index.js,
      and all .js files are included recursively.
*/
function demodule(modules, mainCode, options) {

    // Gather all modulePaths -> file.
    var moduleInfos = {};

    // Get present working directory.
    var pwd = (options||{}).pwd || global.process.env.PWD;

    modules.forEach(function(module) {
        var name = module.name;
        var path = canonical(pwd, module.path);
        var m = getModuleInfos(name, path);
        m.forEach(function(info) {
            moduleInfos[info.modulePath] = info;
        });
    });

    //console.log("modules:\n", moduleInfos);
    var compacted = compactFiles(moduleInfos, mainCode);

    console.log("compacted:\n", compacted);

    eval(compacted);
}

// Convert paths to absolute paths & make trailing slash for directories.
function canonical(pwd, path) {
    if (!path.startsWith("/")) { path = pwd+"/"+path; } // Convert to to absolute path.
    path = fs.realpathSync(path);   // Resolve /./, /../ etc.
    if (isDirectory(path)) {
        if (!path.endsWith("/")) { path = path + "/"; } // Ensure trailing "/".
    }
    return path;
}

// Given a module path & (directory) path, get all the files in the module.
// Returns an Array of objects {modulePath, relPath, code}
function getModuleInfos(name, path) {
    var rootDir     = path;
    var searchGlob  = path;
    if (searchGlob.endsWith("/")) { searchGlob = searchGlob+"**/*.js"; }
    return glob.sync(searchGlob).map(function(filePath) {
        if (!filePath.endsWith(".js")) { throw "filePath "+filePath+" isn't a javascript file."; }
        var code        = readFile(filePath);
        var relPath     = filePath.substring(rootDir.length, filePath.length-3);
        var modulePath  = name+"/"+relPath;
        return {
            modulePath: modulePath,
            relPath:    relPath,
            code:       code,
        };
    });
}

// Returns true if path is a directory.
function isDirectory(path) {
    return fs.statSync(path).isDirectory();
}

function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// This is a function that will get serialized.
// Thus this function must be self-containing with no references to
//  outer variables.
// It must not use sugar.js syntax.
// moduleFuncs: { <modulePath>: <moduleFunc> }
function makeRequire(moduleFuncs) {

    // This will always point to the current module path.
    var currentModulePath = "__main__";
    // Modules will get cached here.
    var cache = {};
    // The require function that gets called.
    function require(path) {
        var resolvedPath = resolvePath(getDirectory(currentModulePath), path);
        if (Object.hasOwnProperty.call(cache, resolvedPath)) {
            return cache[resolvedPath];
        } else {
            var module = undefined;
            var moduleFunc = moduleFuncs[resolvedPath];
            if (!moduleFunc) { throw "Cannot find module '"+resolvedPath+"'"; }
            var oldModulePath = currentModulePath;
            currentModulePath = resolvedPath;
            try {
                module = cache[resolvedPath] = moduleFunc(cache, resolvedPath, getDirectory(resolvedPath));
            } finally {
                currentModulePath = oldModulePath;
            }
            return module;
        }
    }

    // HELPER FUNCTIONS BELOW
    // Given the current modulePath dir 'currentDir' & the required 'path',
    // find which modulePath 'path' is referring to.
    function resolvePath(currentDir, path) {
        if (path[0] == ".") {
            path = currentDir+path;
        }
        var resolvedParts = [];
        path.split("/").forEach(function(part) {
            if (part == "") { return; }
            if (part == ".") { return; }
            if (part == "..") {
                if (resolvedParts.length == 0) {
                    throw "Cannot resolve path "+path+" from "+currentPath;
                }
                resolvedParts.pop(resolvedParts.length-1);
            } else {
                resolvedParts.push(part);
            }
        });
        return resolvedParts.join("/");
    }

    // Gets the containing directory of a path with trailing slash.
    function getDirectory(path) {
        var parts = path.split("/");
        parts.pop(parts.length-1);
        if (parts.length == 0) { return "/"; }
        else { return parts.join("/")+"/"; }
    }

    return require;
}

function makeModuleFunc(info) {
    var funcCode = ""+
    "(function(cache, modulePath, moduleDir) {\n"+
    "    return new function() {\n"+
    "        var exports = cache[modulePath] = this;\n"+
    "        var module = {exports: exports};\n"+
    "        // var process = ...\n"+
    "        var __filename = modulePath;\n"+
    "        var __dirname = moduleDir;\n"+
    "\n"+
    "// CODE "+info.modulePath+"\n"+
    info.code+
    "// END CODE "+info.modulePath+"\n"+
    "\n"+
    "        cache[modulePath] = module.exports;\n"+
    "        return module.exports;\n"+
    "    };\n"+
    "})"
    return funcCode;
}

function compactFiles(moduleInfos, mainCode) {
    var code = ""+
    "(function() {\n"+
    (''+makeRequire)+"\n"+
    "    var moduleFuncs = {};\n";

    // Insert module code
    for (var modulePath in moduleInfos) {
    var info = moduleInfos[modulePath];
    code += ""+
    "    moduleFuncs['"+modulePath+"'] =\n"+makeModuleFunc(info)+";\n"
    }

    code += ""+
    "    var require = makeRequire(moduleFuncs);\n"+
    "    // delete moduleFuncs.\n"+
    "    // delete makeRequire.\n"+
    "\n"+
    "// CODE __main__\n"+
    mainCode+"\n"+
    "// END CODE __main__\n"+
    "})();\n"
    return code;
}

function minifyCode(code) {
    return uglify.gen_code(uglify.ast_squeeze(uglify.ast_mangle(parser.parse(code), {ascii_only:true}))); // issue on chrome on ubuntu
}

module.exports = demodule;
