const gameLink = window.location.pathname.split('/game/')[1];
let ws;
let canvas, ctx;
let isDrawing = false;
let currentColor = "#000000";
let username;

window.addEventListener("load", function() {
    const userResponse = fetch("/api/user", {
        method: "GET",
        credentials: "include"
    }).then(response => {
        if (!response.ok) {
            throw new Error("Utilisateur non connecté");
        }
        return response.json();
    }).then(userData => {
        username = userData.username || localStorage.getItem('username');
        if (!username) {
            window.location.href = "/login";
            return;
        }

        // Initialiser le canvas
        canvas = document.getElementById("canvas");
        ctx = canvas.getContext("2d");
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        canvas.style.pointerEvents = "none";

        // Événements de dessin
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
        canvas.addEventListener("mouseout", stopDrawing);

        // Palette de couleurs
        const colorButtons = document.querySelectorAll(".color-button");
        colorButtons.forEach(button => {
            button.addEventListener("click", function() {
                currentColor = this.getAttribute("data-color");
                ctx.strokeStyle = currentColor;
            });
        });

        // Effaceur
        document.getElementById("eraser-button").addEventListener("click", function() {
            currentColor = "#ffffff";
            ctx.strokeStyle = currentColor;
        });

        // Bouton "J'ai fini"
        document.getElementById("submit-button").addEventListener("click", submitDrawing);

        // Bouton "Valider" pour les phrases
        document.getElementById("submit-phrase-button").addEventListener("click", submitPhrase);

        // WebSocket
        ws = new WebSocket(`wss://bookish-zebra-694qr94j467ph4w6w-8000.app.github.dev/ws/${gameLink}/${username}`);

        ws.onopen = function() {
            console.log("WebSocket connection established for", username);
        };

        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);

            if (data.action === "update_phase") {
                if (data.phase === "lobby") {
                    document.getElementById("write-area").style.display = "none";
                    document.getElementById("drawing-area").style.display = "none";
                    document.getElementById("reference-container").style.display = "none";
                    document.getElementById("result-container").style.display = "none";
                }
            }

            if (data.action === "start_game") {
                if (data.phase === "write") {
                    document.getElementById("write-title").textContent = "Écrivez une phrase";
                    document.getElementById("phrase-input").placeholder = "Entrez votre phrase";
                    document.getElementById("write-area").style.display = "block";
                    document.getElementById("drawing-area").style.display = "none";
                    document.getElementById("reference-container").style.display = "none";
                    document.getElementById("result-container").style.display = "none";
                }
            }

            if (data.action === "start_round") {
                if (data.username !== username) return;

                if (data.phase === "draw") {
                    document.getElementById("reference-phrase").textContent = data.data;
                    document.getElementById("reference-phrase").style.display = "block";
                    document.getElementById("reference-drawing").style.display = "none";
                    document.getElementById("reference-container").style.display = "flex";
                    document.getElementById("drawing-area").style.display = "flex";
                    document.getElementById("write-area").style.display = "none";
                    document.getElementById("result-container").style.display = "none";
                    canvas.style.pointerEvents = "auto";
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else if (data.phase === "guess") {
                    document.getElementById("reference-drawing").src = data.data;
                    document.getElementById("reference-drawing").style.display = "block";
                    document.getElementById("reference-phrase").style.display = "none";
                    document.getElementById("reference-container").style.display = "flex";
                    document.getElementById("write-area").style.display = "block";
                    document.getElementById("drawing-area").style.display = "none";
                    document.getElementById("result-container").style.display = "none";
                    document.getElementById("write-title").textContent = "Devinez ce que représente ce dessin";
                    document.getElementById("phrase-input").placeholder = "Entrez votre devinette";
                    document.getElementById("phrase-input").value = "";
                }
            }

            if (data.action === "update_timer") {
                document.getElementById("timer").textContent = `Temps restant : ${data.timer}s`;
            }

            if (data.action === "show_result") {
                document.getElementById("drawing-area").style.display = "none";
                document.getElementById("write-area").style.display = "none";
                document.getElementById("reference-container").style.display = "none";
                document.getElementById("timer").style.display = "none";

                const resultContainer = document.getElementById("result-container");
                resultContainer.style.display = "flex";
                resultContainer.innerHTML = "<h2>Résultats</h2>";

                const playerData = data.player_data;
                const playersOrder = data.players_order;

                for (let i = 0; i < playersOrder.length; i++) {
                    const sequenceDiv = document.createElement("div");
                    sequenceDiv.className = "sequence";
                    sequenceDiv.innerHTML = `<h3>Séquence de ${playersOrder[i]}</h3>`;

                    let currentPlayer = playersOrder[i];
                    for (let round = 1; round <= data.player_data[currentPlayer].length; round++) {
                        const roundData = data.player_data[currentPlayer][round - 1];
                        if (roundData.type === "phrase" || roundData.type === "guess") {
                            const p = document.createElement("p");
                            p.textContent = roundData.value;
                            sequenceDiv.appendChild(p);
                        } else if (roundData.type === "drawing") {
                            const img = document.createElement("img");
                            img.src = roundData.value;
                            sequenceDiv.appendChild(img);
                        }
                        const currentIndex = playersOrder.indexOf(currentPlayer);
                        currentPlayer = playersOrder[(currentIndex + 1) % playersOrder.length];
                    }

                    resultContainer.appendChild(sequenceDiv);
                }
            }
        };

        ws.onclose = function() {
            console.log("WebSocket connection closed for", username);
        };

        ws.onerror = function(error) {
            console.log("WebSocket error for", username, ":", error);
        };
    }).catch(error => {
        console.log("Erreur lors du chargement du jeu:", error);
        window.location.href = "/login";
    });
});

function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function submitDrawing() {
    const drawingData = canvas.toDataURL("image/png");
    ws.send(JSON.stringify({
        action: "submit_drawing",
        drawing_data: drawingData
    }));
    canvas.style.pointerEvents = "none";
    document.getElementById("drawing-area").style.display = "none";
}

function submitPhrase() {
    const phrase = document.getElementById("phrase-input").value.trim();
    if (!phrase) {
        alert("Veuillez entrer une phrase ou une devinette !");
        return;
    }
    ws.send(JSON.stringify({
        action: "submit_phrase",
        phrase: phrase
    }));
    document.getElementById("write-area").style.display = "none";
}