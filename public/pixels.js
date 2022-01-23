// add recaptcha listener
let recaptchaReady = false;
window.onRecaptchaLoad = () => recaptchaReady = true;

// html elements
const timerElem = document.getElementById("timer");
const timerBar = document.getElementById("timer-bar");
const captchaLayer = document.getElementById("captcha-overlay");
const errorLayer = document.getElementById("error-text");

// canvas
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// state
let timer = 0;
let color = 0;
let maxPlaceDelay;
let settingsReceived = false, canvasData = null;

// add the palette
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

// --- draw initial canvas
const initCanvas = () => {
    if(settingsReceived && canvasData) {
        for(let x = 0; x < canvas.width; x++) {
            for(let y = 0; y < canvas.height; y++) {
                ctx.fillStyle = PALETTE[canvasData[y * canvas.width + x]];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
};

// handle server connection
let socket;
const connect = port => {
    
    socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:${port}/`);
    socket.binaryType = "arraybuffer";

    socket.addEventListener("message", (event) => {
        try {

            // the only binary message is the initial canvas data
            if(event.data instanceof ArrayBuffer) {
                canvasData = new Uint8Array(event.data);
                initCanvas();
                return;
            }

            const message = JSON.parse(event.data);
            if(message.error) { 
                alert(message.error);
                return;
            }
            
            if(message.type === "settings") {
                maxPlaceDelay = message.placeDelay / 1000 * 60;
                canvas.width = message.width;
                canvas.height = message.height;
                settingsReceived = true;
                initCanvas();
                return;
            }
            
            if(message.type === "place") {
                ctx.fillStyle = PALETTE[message.color];
                ctx.fillRect(message.x, message.y, 1, 1);
                canvasData[message.y * canvas.width + message.x] = message.color;
                return;
            }
            
            if(message.type === "captcha") {
                captchaLayer.style.display = "";
                if(recaptchaReady) {
                    grecaptcha.reset();
                } 
            }

        } catch(error) {
            console.error(error);
            alert("Failed to handle server message");
        }

    });

    socket.addEventListener("close", () => {
        errorLayer.style.display = "";
    });

};

// connect to the server
fetch("/port").then(resp => resp.text()).then(port => connect(port));

// --- UI logic
document.getElementById("submit-captcha").addEventListener("click", () => {
    if(grecaptcha.getResponse()) {
        captchaLayer.style.display = "none";
        socket.send(JSON.stringify({action: "captcha", value: grecaptcha.getResponse()}));
    }
});

const animateTimer = () => {
    timerElem.style.display = "";
    timerBar.style.width = `${timer / maxPlaceDelay * 100}%`;
    timer--;
    if(timer > 0) {
        requestAnimationFrame(animateTimer);
    } else {
        timerElem.style.display = "none";
    }
};

let canvasX = 0, canvasY = 0;
let cameraX = 0, cameraY = 0;
let mouseX = 0, mouseY = 0;

let scale = 1, scrollLevel = 0;
let mouseDown = false, moves = 0;

canvas.addEventListener("click", (event) => {
    if(timer == 0 && moves < 2) {
        socket.send(JSON.stringify({action: "place", x: canvasX, y: canvasY, color}));
        timer = maxPlaceDelay;
        animateTimer();
    }
});

const updateTransform = () => {
    canvas.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${cameraX}, ${cameraY})`;
};

window.addEventListener("mousedown", () => {
    mouseDown = true;
    moves = 0;
});

window.addEventListener("mouseup", () => mouseDown = false);
window.addEventListener("mousemove", (event) => {

    mouseX = event.clientX;
    mouseY = event.clientY;
    
    // undraw overlay pixel
    ctx.fillStyle = PALETTE[canvasData[canvasY * canvas.width + canvasX]];
    ctx.fillRect(canvasX, canvasY, 1, 1);
    
    canvasX = Math.floor((mouseX - cameraX) / scale);
    canvasY = Math.floor((mouseY - cameraY) / scale);

    // draw new overlay pixel
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = PALETTE[color];
    ctx.fillRect(canvasX, canvasY, 1, 1);
    ctx.globalAlpha = 1.0;

    // draw pixel
    if(mouseDown) {
        moves++;
        cameraX += event.movementX;
        cameraY += event.movementY;
        updateTransform();
    }
    
});

window.addEventListener("wheel", (event) => {

    // scroll towards mouse:
    // we know that canvasX * scale + cameraX = windowX
    // we want newX such that canvasX * newScale + newX = windowX
    // canvasX * scale + cameraX = canvasX * newScale + newX
    // newX = canvasX * scale - canvasX * newScale
    //      = canvasX (scale - newScale)
    // we don't know canvasX, but we can just use the initial relationship:
    // canvasX = (windowX - cameraX) / scale
    // thus,
    // newX = (windowX - cameraX) / scale * (scale - newScale)

    scrollLevel -= event.deltaY / 100;
    const oldScale = scale;
    scale = Math.pow(1.2, scrollLevel);
    cameraX += canvasX * (oldScale - scale);
    cameraY += canvasY * (oldScale - scale);
    updateTransform();

});