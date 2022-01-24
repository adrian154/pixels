const config = require("./config.json");
const Canvas = require("./canvas.js");
const fetch = require("node-fetch");
const Express = require("express");

// state
const canvas = new Canvas(512, 512, "canvas.dat");
const wsServer = require("./ws.js");
const users = new Map();

// constants
const COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

wsServer.on("connection", (ws, req) => {

    // figure out the user's address
    const addr = config.proxy ? req.headers["X-Forwarded-For"].split(",")[0] : ws._socket.remoteAddress;
    console.log(`${addr} connected`);

    // get user
    let user = users.get(addr);
    if(!user) {
        user = {
            lastPlaceTime: Date.now(),
            counter: 0,
            alive: true
        };
        users.set(addr, user);
        ws.user = user;
    }

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

                    if(user.counter % config.pixelsPerCaptcha == 0 && !config.noCaptcha) {
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
            } else if(message.action === "pong") {
                user.alive = true;
            }

        } catch(error) {
            console.error(error);
        }

    });

    ws.send(canvas.data);
    ws.send(JSON.stringify({
        type: "settings",
        width: canvas.width,
        height: canvas.height,
        placeDelay: config.placeDelay,
        palette: config.palette
    }));

    if(!config.noCaptcha) {
        ws.send(JSON.stringify({type: "captcha"}));
    }

});

// periodically ping sockets
setInterval(() => {
    const json = JSON.stringify({type: "ping"});
    for(const client of wsServer.clients) {
        if(client.user) {
            if(!client.user.alive) {
                console.log(`Connection with ${client.user.alive} appears to have dropped, terminating...`);
                client.terminate();
            }
            client.send(json);
            client.user.alive = false;
        }
    }
}, config.pingInterval);

// save canvas
setInterval(() => canvas.save(), config.saveInterval);
canvas.save();

// set up express server
const app = Express();

app.use(Express.static("public"));
app.get("/port", (req, res) => res.send(String(config.socketPort)));
app.listen(config.webPort, () => console.log("Webserver started"));