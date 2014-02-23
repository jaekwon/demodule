var demodule = require("./demodule");

// This will get serialized.
function test() {
    someglobal = "someglobal";
    var foo = require('example/foo');
    console.log('[main] foo:', foo);
}

var code = demodule(
    [
        {name:"example", path:"./example"},
    ],
    ('('+test+')();')
);

eval(code);
