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
function demodule(modules, mainCode, options) { options = options||{};

    // Gather all modulePaths -> file.
    var moduleInfos = {};

    // Get present working directory.
    var pwd = options.pwd || global.process.env.PWD;

    modules.forEach(function(module) {
        if (!module.name) { throw "A module must have a name"; }
        if (!module.path) { throw "Please specify a path for module '"+module.name+"'"; }
        var name = module.name;
        var path = canonical(pwd, module.path);
        var m = getModuleInfos(name, path);
        m.forEach(function(info) {
            moduleInfos[info.modulePath] = info;
        });
    });

    if (options.debug) {
        for (var path in moduleInfos) {
            var info = moduleInfos[path];
            console.log("Found module:", info.modulePath, "\n    ->", info.filePath);
        }
    }

    var compacted = compactFiles(moduleInfos, mainCode);

    if (options.minify) { compacted = minifyCode(compacted); }

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

// Given a module (root) name & filesystem path, get all the module files.
// Returns an Array of objects {modulePath, fileName, filePath, code}
function getModuleInfos(name, path) {
    var rootDir     = getDirectory(path);
    var searchGlob  = path;
    var isDir       = path.endsWith("/");
    if (isDir) { searchGlob = searchGlob+"**/*.js"; }
    return glob.sync(searchGlob).map(function(filePath) {
        if (!filePath.endsWith(".js")) { throw "filePath "+filePath+" isn't a javascript file."; }
        var code        = readFile(filePath);
        var fileName    = filePath.substring(rootDir.length);
        var modulePath;
        if (isDir) { modulePath = name+"/"+fileName.substring(0, fileName.length-3); }
        else       { modulePath = name; }
        return {
            modulePath: modulePath,
            fileName:   fileName,
            filePath:   filePath,
            code:       code,
        };
    });
}

// Returns true if path is a directory.
function isDirectory(path) {
    return fs.statSync(path).isDirectory();
}

// Gets the containing directory of a path with trailing slash.
function getDirectory(path) {
    var parts = path.split("/");
    parts.pop(parts.length-1);
    if (parts.length == 0) { return "/"; }
    else { return parts.join("/")+"/"; }
}

function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// This is a function that will get serialized.
// Thus this function must be self-containing with no references to
//  outer variables.
// moduleFuncs: { <modulePath>: <moduleFunc> }
function makeRequire(moduleFuncs) {

    // Modules will get cached here.
    var cache = {};

    function makeRequireFor(modulePath) {
        return function(path) { return __require(modulePath, path); };
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

    // This resolves '.' and '..' in the required 'path'
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

    // Gets the containing directory of a path with trailing slash.
    function getModuleDir(path) {
        var parts = path.split("/");
        parts.pop(parts.length-1);
        if (parts.length == 0) { return "/"; }
        else { return parts.join("/")+"/"; }
    }

    return makeRequireFor("__main__");
}

function makeModuleFunc(info) {
    var header = ""+
    "(function(cache, modulePath, moduleDir, require) {\n"+
    "    return new function() {\n"+
    "        var exports = cache[modulePath] = this;\n"+
    "        var module = {exports: exports};\n"+
    "        // var process = ...\n"+
    "        var __filename = modulePath;\n"+
    "        var __dirname = moduleDir;\n";

    var body = "\n"+
    "// CODE "+info.modulePath+"\n"+
    info.code+
    "// END CODE "+info.modulePath+"\n";

    var footer = "\n"+
    "        cache[modulePath] = module.exports;\n"+
    "        return module.exports;\n"+
    "    };\n"+
    "})"

    header = header.replace(/\n */g, '');
    footer = footer.replace(/\n */g, '');
    return header + body + footer;
}

function compactFiles(moduleInfos, mainCode) {
    var code = ""+
    "(function() {\n"+
    (''+makeRequire)+"\n"+
    "    var moduleFuncs = {};\n\n";

    // Insert module code
    for (var modulePath in moduleInfos) {
        var info = moduleInfos[modulePath];
        code += "moduleFuncs['"+modulePath+"'] = "+makeModuleFunc(info)+";\n\n"
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
