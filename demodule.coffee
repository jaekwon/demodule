require 'sugar'
assert = require 'assert'
findit = require 'findit'
{parser, uglify} = require 'uglify-js'
coffee = require 'coffee-script'

compact = (array) -> item for item in array when item

# modules:    An array of {name:MODULE, path:PATH},
#             MODULE is a string that represents a module name.
#             E.g. you would require(MODULE) to import a module.
#             PATH is a string of the source file (or directory, see below) with an optional suffix.
#             If PATH ends with '/**.SUFFIX', it takes all files inside the directory (recursively),
#
# compilers:  (Optional) An object of {SUFFIX:COMPILER},
#             SUFFIX is the file suffix that the compiler recognizes. e.g. 'coffee'
#             COMPILER is a function, takes a source code string and returns the compiled javascript.
module.exports = (modules, callback, options = {}) ->
  compilers       = options.compilers ? {}
  compilers['js'] ?= (code) -> code
  compilers['coffee'] ?= (code) -> coffee.compile(code)
  rootDir         = options.rootDir       ? ''
  builtins        = options.builtins      ? yes

  # If we need to include builtins, make sure that
  # the builtins are readable.
  if builtins
    assert.ok __filename.endsWith('demodule.js')
    builtinsPath = "#{__filename[...__filename.length-12]}/builtins"
    for filepath in findit.findSync(builtinsPath)
      modules.push name:filepath.split('/').last()[...-3], path:filepath

  toCompile = [] # array of {file:FILENAME, fn:COMPILER, name:MODULENAME}
  knownSuffixes = Object.keys(compilers)

  for {name, path} in modules
    path = rootDir+path if not path.startsWith '/'
    [_, dirpath, suffixFilter] = path.match(/(.*?)\/\*\*\.([a-zA-Z0-9]+)$/) ? []
    if dirpath
      for filepath in findit.findSync(dirpath)
        [_, filename, suffix] = filepath.match(/(.*?)(?:\.([a-zA-Z0-9]+))?$/)
        continue if not suffix
        continue if suffixFilter and suffix isnt suffixFilter
        relpath = filename[dirpath.length...]
        relpath = relpath[1..] if relpath.startsWith '/'
        if relpath is 'index'
          modulename = name or 'index'
        else if relpath.endsWith '/index'
          modulename = compact([name, relpath[...-6]]).join('/')
        else
          modulename = compact([name, relpath]).join('/')
        compiler = compilers[suffix]
        if not compiler
          console.log "DEmodule ignored file with no compiler: #{filepath}"
          continue
        toCompile.push {file:filepath, fn:compiler, name:modulename}
    else
      filepath = path
      [_, filename, suffix] = filepath.match(/(.*?)(?:\.([a-zA-Z0-9]+))?$/)
      compiler = compilers[suffix]
      throw new Error "Dunno how to compile '#{filepath}' with #{suffix} suffix" if not compiler
      toCompile.push {file:filepath, fn:compiler, name:name}

  # look for dupes
  _files = {}
  _modules = {}
  for {file,name} in toCompile
    console.log "WARN: Duplicate file #{file}" if _files[file]
    throw new Error "Duplicate module #{name}" if _modules[name]
    _files[file] = _modules[name] = yes

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
            function require(path){
              var module = require[path];
              if (!module) {
                throw new Error("Can't find module "+path);
              }
              if (module.nonce === nonce) {
                module = module();
                return module;
              } else {
                return module;
              }
            }
            #{derequired}
            #{callback}
        })();
    })(this);
  """
  minCode = uglify.gen_code (uglify.ast_squeeze uglify.ast_mangle parser.parse code), ascii_only:yes # issue on chrome on ubuntu
  return {code, minCode}
