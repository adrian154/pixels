const config = require("./config.json");
const Canvas = require("./canvas.js");
const fetch = require("node-fetch");
const Express = require("express");
const WebSocket = require("ws");

// state
const canvas = new Canvas(512, 512, "canvas.dat");
const wsServer = new WebSocket.Server({port: config.socketPort});
const users = {};

// constants
const COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

wsServer.on("connection", (ws, req) => {

    const addr = config.proxy ? req.headers["X-Forwarded-For"].split(",")[0] : ws._socket.remoteAddress;
    const user = users[addr] ?? (users[addr] = {
        lastPlaceTime: Date.now(),
        counter: 0
    });

    if(config.noCaptcha) {
        user.captcha = true;
    }

    ws.on("message", async messageText => {
 
        try {

            const message = JSON.parse(messageText);
            if(message.action === "place") {
            
                if(Date.now() - user.lastPlaceTime > config.placeDelay) {
            
                    const x = Math.trunc(Number(message.x));
                    const y = Math.trunc(Number(message.y));
                    const color = Number(message.color);

                    if(!canvas.inBounds(x, y) || !COLORS.includes(color) || !user.captcha) {
                        return;
                    }       
            
                    canvas.set(x, y, color);

                    // broadcast the update
                    const json = JSON.stringify({type: "place", x, y, color});
                    for(const client of wsServer.clients) {
                        client.send(json);
                    }
            
                    user.lastPlaceTime = Date.now();
                    user.counter++;

                    if(user.placed % 100 == 0 && !config.noCaptcha) {
                        user.captcha = false;
                        ws.send(JSON.stringify({type: "captcha"}));
                    }
            
                }
            
            } else if(message.action === "captcha") {

                if(typeof message.value !== "string") return;
                const resp = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(config.recaptchaSecret)}&response=${encodeURIComponent(message.value)}`, {method: "POST",});
                const apiResp = await resp.json();
                if(apiResp.success) {
                    user.captcha = true;
                }
                
            }

        } catch(error) {
            console.error(error);
        }

    });

    ws.send(JSON.stringify({
        type: "settings",
        width: canvas.width,
        height: canvas.height,
        placeDelay: config.placeDelay,
        palette: config.palette
    }));
    ws.send(canvas.data);

    if(!config.noCaptcha) {
        ws.send(JSON.stringify({type: "captcha"}));
    }

});

// set up express server
const app = Express();

app.use(Express.static("public"));
app.get("/port", (req, res) => res.send(String(config.socketPort)));
app.listen(config.webPort, () => console.log("Webserver started"));