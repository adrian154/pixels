const {BufferReader, BufferBuilder} = require("bufferpants");
const config = require("./config.json");
const {PNG} = require("pngjs");
const fs = require("fs");

// convert palette to 
const PALETTE = config.palette.map(color => parseInt(color.slice(1), 16));

class Canvas {

    constructor(width, height, filename) {

        // set fields
        this.width = width;
        this.height = height;
        this.data = Buffer.alloc(width * height, 15);
        this.filename = filename;
        this.load();

        // save on kill
        process.on("SIGTERM", () => {
            this.save();
            process.exit(0);
        });

    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    set(x, y, value) {
        this.data[y * this.width + x] = value;
    }

    load() {
        
        if(!fs.existsSync(this.filename)) {
            console.log("The canvas file doesn't exist yet, it will be created when the canvas is saved");
            return;
        }

        const data = fs.readFileSync(this.filename);
        const reader = new BufferReader(data);
        const width = reader.readUInt16LE(), height = reader.readUInt16LE();
        if(width > this.width || height > this.height) {
            throw new Error(`Stored canvas is too large (${width}x${height} vs ${this.width}x${this.height})`);
        }

        const pixels = reader.readBuffer(width * height);
        for(let x = 0; x < width; x++) {
            for(let y = 0; y < height; y++) {
                this.set(x, y, pixels[y * width + x]);
            }
        }

    }

    save() {
    
        // write canvas.dat
        const builder = new BufferBuilder();
        builder.writeUInt16LE(this.width).writeUInt16LE(this.height).writeBuffer(this.data);
        fs.writeFileSync(this.filename, builder.build());
    
        // write png
        const png = new PNG({
            width: this.width,
            height: this.height,
        });

        for(let x = 0; x < this.width; x++) {
            for(let y = 0; y < this.height; y++) {
                const idx = this.width * y + x;
                const color = PALETTE[this.data[idx]];
                png.data[idx * 4] = color >> 16;
                png.data[idx * 4 + 1] = (color >> 8) & 0xff;
                png.data[idx * 4 + 2] = color & 0xff;
                png.data[idx * 4 + 3] = 0xff;
            }
        }

        png.pack().pipe(fs.createWriteStream("public/canvas.png")).on("finish", () => {
            console.log("Saved canvas");
        });

    }

}

module.exports = Canvas;