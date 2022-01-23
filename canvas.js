const {BufferReader, BufferBuilder} = require("bufferpants");
const config = require("./config.json");
const fs = require("fs");

class Canvas {

    constructor(width, height, filename) {

        // set fields
        this.width = width;
        this.height = height;
        this.data = Buffer.alloc(width * height, 15);
        this.filename = filename;
        this.load();

        // save periodically
        setInterval(() => this.save(), config.saveInterval);

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
        const builder = new BufferBuilder();
        builder.writeUInt16LE(this.width).writeUInt16LE(this.height).writeBuffer(this.data);
        fs.writeFileSync(this.filename, builder.build());
        console.log("Saved canvas");
    }

}

module.exports = Canvas;