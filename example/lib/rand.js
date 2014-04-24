// e.g. randId(5) -> "aEs12"
function randId(len) {
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    var chars = [];
    for (var i=0; i<len; i++) {
        chars.push(possible.charAt(Math.floor(Math.random() * possible.length)))
    }
    return chars.join("");
}

exports.randId = randId;
