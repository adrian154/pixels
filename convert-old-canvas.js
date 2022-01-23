// convert old JSON canvas to new canvas.dat
const old = require("./canvas.json");

const Canvas = require("./canvas.js");
const canvas = new Canvas(old.length, old[0].length, "public/canvas.dat");

for(let x = 0; x < old.length; x++) {
    for(let y = 0; y < old[x].length; y++) {
        canvas.set(x, y, old[x][y]);
    }
}

canvas.save();