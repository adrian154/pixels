const Express = require("express");
const WebSocket = require("ws");
const fs = require("fs");
const fetch = require("node-fetch");
const config = require("./config.json");
const https = require("https");

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

const users = {};

wss.on("connection", ws => {

    const addr = ws._socket.remoteAddress;
    const user = users[addr] ?? (users[addr] = {
        lastPlaceTime: Date.now(),
        captchaTime: Date.now(),
        placed: 0
    });

    ws.on("message", messageText => {
 
        try {
            const message = JSON.parse(messageText);
            
            if(message.action === "place") {
            
                if(Date.now() - user.lastPlaceTime > config.placeDelay) {
            
                    // validate message
                    if(typeof message.x !== "number" ||
                        typeof message.y !== "number" ||
                        typeof message.color !== "number" ||
                        message.x < 0 ||
                        message.y < 0 ||
                        message.x > board.length ||
                        message.y > board[0].length ||
                        message.color < 0 ||
                        message.color > 16 ||
                        !user.captcha)
                        return;                
            
                    // actually place pixel
                    message.x = Math.trunc(message.x);
                    message.y = Math.trunc(message.y);
                    board[message.x][message.y] = message.color;
                    console.log(addr);
            
                    for(const client of wss.clients) {
                        client.send(JSON.stringify({
                            type: "place",
                            x: message.x,
                            y: message.y,
                            color: message.color 
                        }));
                    }
            
                    user.lastPlaceTime = Date.now();
                    user.placed++;

                    if(user.placed % 100 == 0) {
                        user.captcha = false;
                        user.captchaTime = Date.now();
                        ws.send(JSON.stringify({type: "captcha"}));
                    }
            
                }
            
            } else if(message.action === "captcha") {

                if(typeof message.value !== "string")
                    return;

                fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${config.recaptchaSecret}&response=${message.value}`, {
                    method: "POST",
                }).then(resp => resp.json()).then(resp => {
                    if(resp.success && new Date(resp.challenge_ts) > user.captchaTime) {
                        user.captcha = true;
                    }
                }).catch(console.error);

            }

        } catch(error) {
            console.error("failed to handle message: " + error);
        }
    });

    ws.send(JSON.stringify({type: "initial", board: board, placeDelay: config.placeDelay}));
    ws.send(JSON.stringify({type: "captcha"}));

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
process.on("SIGTERM", () => {
    save();
    process.exit();
});