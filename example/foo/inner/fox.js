// test circular import, continued...
var emu = require("./emu");

exports.test = function() {
    if (emu.something() == "SOMETHING") {
        return "what does the fox say?";
    } else {
        return "recursive import is broken";
    }
}
