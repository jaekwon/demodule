assert = require 'assert'
findit = require 'findit'
{parser, uglify} = require 'uglify-js'
coffee = require 'coffee-script'
fs     = require 'fs'

compact = (array) -> item for item in array when item
startsWith = (string, literal, start) ->
  literal is string.substr start, literal.length
endsWith = (string, literal, back) ->
  len = literal.length
  literal is string.substr string.length - len - (back or 0), len
last = (array, back) -> array[array.length - (back or 0) - 1]

# modules:    An array of {name:MODULE, path:PATH},
#             MODULE is a string that represents a module name.
#             E.g. you would require(MODULE) to import a module.
#             PATH is a string of the source file (or directory, see below) with an optional suffix.
#             If PATH ends with '/**.SUFFIX', it takes all files inside the directory (recursively),
#
# options:
#   compilers:  (Optional) An object of {SUFFIX:COMPILER},
#               SUFFIX is the file suffix that the compiler recognizes. e.g. 'coffee'
#               COMPILER is a function, takes a source code string and returns the compiled javascript.
#   minimize:   Minimize output and return as {code,minCode}. Default 'yes'
module.exports = (modules, callback, options = {}) ->
  compilers       = options.compilers ? {}
  compilers['js'] ?= (code) -> code
  compilers['coffee'] ?= (code) -> coffee.compile(code)
  rootDir         = options.rootDir       ? ''
  builtins        = options.builtins      ? yes
  minimize        = options.minimize      ? yes

  # If we need to include builtins, make sure that
  # the builtins are readable.
  if builtins
    assert.ok endsWith __filename, 'demodule.js'
    builtinsPath = "#{__filename[...__filename.length-12]}/builtins"
    for filepath in findit.findSync(builtinsPath)
      modules.push name:last(filepath.split('/'))[...-3], path:filepath

  toCompile = [] # array of {file:FILENAME, fn:COMPILER, name:MODULENAME}
  knownSuffixes = Object.keys(compilers)

  for {name, path} in modules
    path = rootDir+path if not startsWith(path, '/')
    [_, dirpath, recursive, suffixFilter] = path.match(/(.*?)\/\*(\*?)\.([a-zA-Z0-9]+)$/) ? []

    # If we're adding a directory
    if dirpath
      dirpath = fs.realpathSync(dirpath)
      if recursive
        filepaths = findit.findSync(dirpath)
      else
        filepaths = fs.readdirSync(dirpath).map( (path)->"#{dirpath}/#{path}" )

      # TODO If no files exist, throw a warning

      for filepath in filepaths
        [_, filename, suffix] = filepath.match( /(.*?)(?:\.([a-zA-Z0-9]+))?$/ )
        continue if not suffix
        continue if suffixFilter and suffix isnt suffixFilter
        if filename[...dirpath.length] != dirpath
          throw new Error "Demodule doesn't know how to deal with inner symlinks (yet)"
        relpath = filename[dirpath.length...]
        relpath = relpath[1..] if startsWith(relpath, '/')
        if relpath is 'index'
          modulename = name or 'index'
        else if endsWith relpath, '/index'
          modulename = compact([name, relpath[...-6]]).join('/')
        else
          modulename = compact([name, relpath]).join('/')
        console.log "Demodule packing #{modulename} -> #{filename}"
        compiler = compilers[suffix]
        if not compiler
          console.log "Demodule ignored file with no compiler: #{filepath}"
          continue
        toCompile.push {file:filepath, fn:compiler, name:modulename}

    # Otherwise if we're adding a file
    else
      filepath = path
      [_, filename, suffix] = filepath.match(/(.*?)(?:\.([a-zA-Z0-9]+))?$/)
      compiler = compilers[suffix]
      throw new Error "Dunno how to compile '#{filepath}' with #{suffix} suffix" if not compiler
      console.log "Demodule packing #{name} -> #{filepath}"
      toCompile.push {file:filepath, fn:compiler, name:name}

  # look for dupes
  _files = {}
  _modules = {}
  for {file,name} in toCompile
    console.log "WARN: Duplicate file #{file}" if _files[file]
    throw new Error "Duplicate module #{name}" if _modules[name]
    _files[file] = _modules[name] = yes

  console.log "Demodule packed #{toCompile.length} files!"

  derequired = ''
  for {file,name,fn} in toCompile
    source = require('fs').readFileSync file, 'utf8'
    compiled = fn(source)
    derequired += """
      require['#{name}'] = function() {
          return new function() {
              var exports = require['#{name}'] = this;
              var module = {exports:exports};
              var process = require("__browserify_process");
              var __filename = "#{file}";
              #{compiled}
              return (require['#{name}'] = module.exports);
          };
      };
      require['#{name}'].nonce = nonce;\n\n
    """

  code = """
    (function(root) {
        return (function() {

            var nonce = {nonce:'nonce'};
            var currentAbsModulePath = '';

            function require( path ) {
              // resolve relative path
              if (path.substr(0,2) === './') {
                path = currentAbsModulePath + path.substr(1);
              }
              //
              var module = require[path];
              if (!module) {
                throw new Error("Can't find module "+path);
              }
              // if we haven't run the module yet
              if (module.nonce === nonce) {
                var oldAbsModulePath = currentAbsModulePath;
                currentAbsModulePath = pathDir(path);
                module = module();
                currentAbsModulePath = oldAbsModulePath;
                return module;
              } else {
                return module;
              }
            }

            function pathDir( path ) {
              var lastSlash = path.lastIndexOf("/");
              if (lastSlash === -1) {
                return path;
              } else {
                return path.substring(0,lastSlash);
              }
            }

            #{derequired}
            #{callback}
        })();
    })(this);
  """
  if minimize
    minCode = uglify.gen_code (uglify.ast_squeeze uglify.ast_mangle parser.parse code), ascii_only:yes # issue on chrome on ubuntu
  return {code, minCode}
