const config = require("./config.json");
const WebSocket = require("ws");
const https = require("https");
const fs = require("fs");

if(config.ssl) {
    const httpsServer = https.createServer({
        key: fs.readFileSync(config.ssl.key),
        cert: fs.readFileSync(config.ssl.cert)
    });
    httpsServer.listen(config.socketPort);
    module.exports = new WebSocket.Server({server: httpsServer});
} else {
    module.exports = new WebSocket.Server({port: config.socketPort});
}