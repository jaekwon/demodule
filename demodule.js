var glob = require("glob");
var ug = require("uglify-js");
var parser = ug.parser;
var uglify = ug.uglify;
var fs = require("fs");
require("sugar");

/*
    moduleInfos: An array of {name, path}
      name:   Can contain slashes, but must not end in a slash.
      path:   Is a file or folder.
    options:
      minify: Minify the code using uglify.
      debug:  Print debug information during the build.
      output: Output file name.
*/
function demodule(moduleInfos, options) { options = options||{};

    var modules = {};
    var pwd = options.pwd || global.process.env.PWD;

    moduleInfos.forEach(function(info) {
        if (!info.name) { throw "A module must have a name"; }
        if (!info.path) { throw "Please specify a path for module '"+info.name+"'"; }
        var rootName = info.name;
        var path = canonical(pwd, info.path);
        var ms = getModules(rootName, path);
        ms.forEach(function(module) {
            modules[module.name] = module;
        });
    });

    // If the user didn't declare __main__, make a default one.
    if (!modules["__main__"]) {
        modules["__main__"] = {
            name:       "__main__",
            fileName:   "__main__",
            filePath:   "__main__",
            code:       "("+defaultMainCode+")()",
        };
    }

    if (options.debug) {
        for (var path in modules) {
            var module = modules[path];
            console.log("Found module:", module.name, "\n    ->", module.filePath);
        }
    }

    // Build and maybe minify code.
    var compacted = build(modules);
    if (options.minify) { compacted = minifyCode(compacted); }

    // write the string to a file.
    if (options.output) {
        var err = require("fs").writeFileSync(options.output, compacted);
        if (err) { throw(err); }
    }

    return compacted;
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

// Given a module root name & filesystem path, get all the module files.
// Returns an Array of objects {name, fileName, filePath, code}
function getModules(rootName, path) {
    var rootDir     = getDirectory(path);
    var searchGlob  = path;
    var isDir       = isDirectory(path);
    if (isDir) { searchGlob = searchGlob+"**/*.js"; }
    return glob.sync(searchGlob).map(function(filePath) {
        if (!filePath.endsWith(".js")) { throw "filePath "+filePath+" isn't a javascript file."; }
        var code        = readFile(filePath);
        var fileName    = filePath.substring(rootDir.length);
        var name;
        if (isDir) { name = rootName+"/"+fileName.substring(0, fileName.length-3); }
        else       { name = rootName; }
        return {
            name:       name,
            fileName:   fileName,
            filePath:   filePath,
            code:       code,
        };
    });
}

function isDirectory(path) {
    return fs.statSync(path).isDirectory();
}

function getDirectory(path) {
    var parts = path.split("/");
    parts.pop(parts.length-1);
    if (parts.length == 0) { return "/"; }
    else { return parts.join("/")+"/"; }
}

function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// Returns the original 'require' function.
// NOTE: This is meant to get serialized to a string.
var makeRequireFunction = function(moduleFuncs) {

    var cache = {};

    function makeRequireFor(name) {
        return function(path) { return __require(name, path); };
    }

    function __require(currentModulePath, path) {
        var resolvedPath = resolveRelativePath(getModuleDir(currentModulePath), path);
        // console.log("resolveRelativePath(", getModuleDir(currentModulePath), ",", path, ") -> ", resolvedPath);

        // Cached?
        if (Object.hasOwnProperty.call(cache, resolvedPath)) { return cache[resolvedPath]; }

        var module = undefined;
        var moduleFunc = moduleFuncs[resolvedPath];
        if (!moduleFunc) {
            resolvedPath = resolvedPath+"/index";
            moduleFunc = moduleFuncs[resolvedPath];
        }
        if (!moduleFunc) {
            console.log("currentModulePath: ", currentModulePath, "path:", path, "resolvedPath:", resolvedPath);
            throw "Cannot find module '"+resolvedPath+"'";
        }
        module = cache[resolvedPath] = moduleFunc(cache, resolvedPath, getModuleDir(resolvedPath), makeRequireFor(resolvedPath));
        return module;
    }

    // HELPER FUNCTIONS BELOW

    function resolveRelativePath(currentDir, path) {
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

    function getModuleDir(path) {
        var parts = path.split("/");
        parts.pop(parts.length-1);
        if (parts.length == 0) { return "/"; }
        else { return parts.join("/")+"/"; }
    }

    return makeRequireFor("__main__");
}
var makeRequireCode = (''+makeRequireFunction);

// Creates a string that wraps the given module into its own closure.
function makeModuleFunc(modules) {
    var header = ""+
    "(function(cache, name, moduleDir, require) {\n"+
    "    return new function() {\n"+
    "        var exports = cache[name] = this;\n"+
    "        var module = {exports: exports};\n"+
    "        // var process = ...\n"+
    "        var __filename = name;\n"+
    "        var __dirname = moduleDir;\n";

    var body = "\n"+
    "// CODE "+modules.name+"\n"+
    modules.code+
    "// END CODE "+modules.name+"\n";

    var footer = "\n"+
    "        cache[name] = module.exports;\n"+
    "        return module.exports;\n"+
    "    };\n"+
    "})"

    header = header.replace(/\n */g, '');
    footer = footer.replace(/\n */g, '');
    return header + body + footer;
}

// Package modules into a single string.
function build(modules) {
    var code = ""+
    "(function() {\n"+
    "    var makeRequire = ("+makeRequireCode+");\n"+
    "    var moduleFuncs = {};\n\n";

    for (var name in modules) {
        var module = modules[name];
        code += "moduleFuncs['"+name+"'] = "+makeModuleFunc(module)+";\n\n"
    }

    code += ""+
    "    var require = makeRequire(moduleFuncs);\n"+
    "    require('__main__');\n"+
    "})();\n"
    return code;
}

// NOTE: This is meant to get serialized to a string.
var defaultMainFunction = function() {
    if (typeof window == "object") {
        window.require = require;
    }
    else if (typeof global == "object") {
        global.require = require;
    }
}
var defaultMainCode = (''+defaultMainFunction);

function minifyCode(code) {
    return uglify.gen_code(uglify.ast_squeeze(uglify.ast_mangle(parser.parse(code), {ascii_only:true}))); // issue on chrome on ubuntu
}

module.exports = demodule;
