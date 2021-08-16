const hiddenCanvas = document.getElementById("hidden-canvas");
const mainCanvas = document.getElementById("main-canvas");
const hiddenCtx = hiddenCanvas.getContext("2d");
const mainCtx = mainCanvas.getContext("2d");
const timerElem = document.getElementById("timer");
const timerBar = document.getElementById("timer-bar");
const captchaLayer = document.getElementById("overlay");

const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8082/`)

let timer = 0;
let color = 0;
let viewX = 0, viewY = 0, pixelX = 0, pixelY = 0, zoom = 1;
let maxPlaceDelay;

const draw = () => {
    
    mainCtx.resetTransform();
    mainCtx.fillStyle = "#eeeeee";
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.translate(Math.trunc(mainCanvas.width / 2), Math.trunc(mainCanvas.height / 2));

    if(socket.readyState == WebSocket.CLOSED) {
        mainCtx.textAlign = "center";
        mainCtx.fillStyle = "#ff0000";
        mainCtx.font = "72px Arial";
        mainCtx.fillText("connection closed, try reloading", 0, 0);
    } else {

        mainCtx.translate(viewX, viewY);
        mainCtx.scale(zoom, zoom);
        mainCtx.translate(Math.trunc(-hiddenCanvas.width/2), Math.trunc(-hiddenCanvas.height/2));

        
        // draw main canvas
        mainCtx.drawImage(hiddenCanvas, 0, 0);

        // draw highlight
        mainCtx.globalAlpha = 0.25;
        mainCtx.fillStyle = PALETTE[color];
        mainCtx.fillRect(pixelX, pixelY, 1, 1);
        mainCtx.globalAlpha = 1.0;

    }

};

// add palette box
const paletteBox = document.getElementById("palette");
for(let i = 0; i < 2; i++) {
    const row = document.createElement("div");
    for(let j = 0; j < 8; j++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        const curColor = i * 8 + j;
        cell.style.backgroundColor = PALETTE[curColor];
        cell.addEventListener("click", () => color = curColor);
        row.appendChild(cell);
    }
    paletteBox.appendChild(row);
}

let recaptchaLoaded = false;
window.onrecaptchaload = () => {
    recaptchaLoaded = true;
};

const submitCAPTCHA = () => {
    if(grecaptcha.getResponse()) {
        captchaLayer.style.display = "none";
        socket.send(JSON.stringify({action: "captcha", value: grecaptcha.getResponse()}));
    }
};

socket.addEventListener("message", packet => {
    try {
        const message = JSON.parse(packet.data);
        if(message.error) { 
            alert(message.error);
        } else if(message.type === "initial") {
            for(let x = 0; x < 256; x++) {
                maxPlaceDelay = message.placeDelay / 1000 * 60;
                for(let y = 0; y < 256; y++) {
                    hiddenCtx.fillStyle = PALETTE[message.board[x][y]];
                    hiddenCtx.fillRect(x, y, 1, 1);
                }
            }
            draw();
        } else if(message.type === "place") {
            hiddenCtx.fillStyle = PALETTE[message.color];
            hiddenCtx.fillRect(message.x, message.y, 1, 1);
            draw();
        } else if(message.type === "captcha") {
            captchaLayer.style.display = "block";
            if(recaptchaLoaded) {
                grecaptcha.reset();
            } 
        }
    } catch(error) {
        console.error(error);
        alert("Failed to handle server message");
    }
});

socket.addEventListener("close", draw);

const handleResize = () => {
    mainCanvas.width = window.innerWidth;
    mainCanvas.height = window.innerHeight;
    mainCtx.imageSmoothingEnabled = false;
    draw();
};

window.addEventListener("resize", handleResize);
handleResize();

const animateTimer = () => {
    timerElem.style.display = "block";
    timerBar.style.width = `${timer / maxPlaceDelay * 100}%`;
    timer--;
    if(timer > 0) {
        requestAnimationFrame(animateTimer);
    } else {
        timerElem.style.display = "none";
    }
};

let mousedown = false, mousemoved = false;
window.addEventListener("mousedown", event => {
    mousedown = true;
    mousemoved = false;
    event.preventDefault();
});

window.addEventListener("mouseup", event => {
    mousedown = false;
});

mainCanvas.addEventListener("click", event => {
    if(timer > 0 || mousemoved) return;
    socket.send(JSON.stringify({
        action: "place",
        x: (event.offsetX - viewX - mainCanvas.width / 2) / zoom + hiddenCanvas.width / 2,
        y: (event.offsetY - viewY - mainCanvas.height / 2) / zoom + hiddenCanvas.height / 2,
        color
    }));
    timer = maxPlaceDelay;
    animateTimer();
});

window.addEventListener("mousemove", event => {
    
    mousemoved = true;
    
    newPixelX = Math.floor((event.offsetX - viewX - mainCanvas.width / 2) / zoom + hiddenCanvas.width / 2);
    newPixelY = Math.floor((event.offsetY - viewY - mainCanvas.height / 2) / zoom + hiddenCanvas.height / 2);
    
    if(mousedown || newPixelX != pixelX || newPixelY != pixelY) {
        if(mousedown) {
            viewX += event.movementX;
            viewY += event.movementY;
        }
        pixelX = newPixelX;
        pixelY = newPixelY;
        draw();
    }

});

let zoomLevel = 0;
window.addEventListener("wheel", event => {
    zoomLevel -= Math.sign(event.deltaY);
    zoom = Math.pow(1.3, zoomLevel);
    draw();
});

window.addEventListener("keydown", event => {
    // TODO
});