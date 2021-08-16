const Express = require("express");
const WebSocket = require("ws");
const fs = require("fs");
const config = require("./config.json");
const https = require("https");

// helper funcs
const validateName = name => {
    name = name.trim().replace(/\s+/g, " ");
    if(name.length < 3 || name.length > 24) return config.defaultName;
};

// set up board
const board = fs.existsSync("./canvas.json") ? require("./canvas.json") : Array.from({length: 256}, () => new Array(256).fill(15));

// set up websocket server
const wss = config.debug ? 
        new WebSocket.Server({port: config.socketPort})
    :
        (() => {
            const httpServer = https.createServer({
                key: fs.readFileSync(config.keyPath),
                cert: fs.readFileSync(config.certPath)
            });
            httpServer.listen(config.socketPort);
            return new WebSocket.Server({server: httpServer});
        })();

wss.on("connection", ws => {

    ws.user = {
        lastPlaceTimestamp: Date.now(),
        name: config.defaultName
    };

    ws.on("message", messageText => {
        try {
            const message = JSON.parse(messageText);
            if(message.action === "place") {
                if(Date.now() - ws.user.lastPlaceTimestamp > config.placeDelay) {
                    if(typeof message.x !== "number" ||
                       typeof message.y !== "number" ||
                       typeof message.color !== "number" ||
                       message.x < 0 ||
                       message.y < 0 ||
                       message.x > board.length ||
                       message.y > board[0].length ||
                       message.color < 0 ||
                       message.color > 16)
                       return;                
                    message.x = Math.trunc(message.x);
                    message.y = Math.trunc(message.y);
                    board[message.x][message.y] = message.color;
                    for(const client of wss.clients) {
                        client.send(JSON.stringify({
                            type: "place",
                            x: message.x,
                            y: message.y,
                            color: message.color 
                        }));
                    }
                    ws.user.lastPlaceTimestamp = Date.now();
                } 
            } else if(message.action === "changename") {
                ws.user.name = validateName(message.name);
            } else if(message.action === "message") {
                // TODO
            }
        } catch(error) {
            console.error("failed to handle message: " + error);
        }
    });

    ws.send(JSON.stringify({type: "initial", board: board, placeDelay: config.placeDelay}));

});

// set up express server
const app = Express();
app.use(Express.static("./static"));
app.listen(config.webPort, () => {
    console.log("Webserver started");
});

// set up save canvas timer
const save = () => {
    fs.writeFileSync("./canvas.json", JSON.stringify(board));
};

setInterval(save, config.saveInterval);
process.on("exit", save);