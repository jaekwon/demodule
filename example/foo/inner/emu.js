// test circular import

exports.something = function() {
    return "SOMETHING";
}

exports.test = require("./fox").test;
