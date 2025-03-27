// Récupérer le game_link et le username depuis l'URL
const gameLink = window.location.pathname.split('/game/')[1];
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');

let ws; // Variable pour stocker la connexion WebSocket
let creator; // Variable pour stocker le nom du créateur
let players = []; // Liste des joueurs
let playerData; // Données des joueurs
let playersOrder; // Ordre des joueurs
let currentStoryIndex = 0; // Index de l'histoire actuelle
let currentContributionIndex = 0; // Index de la contribution actuelle dans l'histoire
let assignedSection = null; // Section attribuée au joueur actuel

window.addEventListener("load", async function() {
    try {
        // Vérifier si un username est présent dans l'URL
        if (!username) {
            throw new Error("Nom d'utilisateur non fourni");
        }

        // Afficher le nom d'utilisateur si l'élément existe
        const usernameDisplay = document.getElementById("username-display");
        if (usernameDisplay) {
            usernameDisplay.textContent = username;
        } else {
            console.warn("Élément 'username-display' non trouvé dans le DOM");
        }

        // Établir une connexion WebSocket pour le jeu
        ws = new WebSocket(`wss://bookish-zebra-694qr94j467ph4w6w-8000.app.github.dev/ws/${gameLink}/${username}`);
        
        ws.onopen = function() {
            console.log("WebSocket connection established for", username);
        };

        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log("Message WebSocket reçu par", username, ":", data);
            console.log("Comparaison username:", { received: data.username, local: username });

            if (data.creator && data.players) {
                // Stocker le créateur et la liste des joueurs
                creator = data.creator;
                players = data.players;
            }

            if (data.action === "update_phase") {
                // Mettre à jour la phase du jeu
                console.log("Mise à jour de la phase:", data.phase, "Tour:", data.current_round);
                updateGamePhase(data.phase, data.current_round);
            } else if (data.action === "start_game") {
                // Gérer le début du jeu pour tous les joueurs
                console.log("Début du jeu pour", username, "- Phase:", data.phase);
                startRound(data.phase, data.current_round, data.timer, data.data || "", data.data_type || "text");
            } else if (data.action === "start_round") {
                // Gérer le début d'un tour (countdown, draw, guess)
                console.log("Message start_round reçu:", { phase: data.phase, username: data.username });
                if (data.username === username) {
                    console.log("Début du tour pour", username, "- Phase:", data.phase);
                    startRound(data.phase, data.current_round, data.timer, data.data, data.data_type);
                } else {
                    console.log("Message start_round ignoré - username ne correspond pas:", { received: data.username, local: username });
                }
            } else if (data.action === "update_timer") {
                // Mettre à jour le timer dans l'interface
                updateTimer(data.timer);
            } else if (data.action === "show_result") {
                // Stocker les données et afficher les résultats
                playerData = data.player_data;
                playersOrder = data.players_order;
                currentStoryIndex = data.currentStoryIndex;
                currentContributionIndex = data.currentContributionIndex;
                showResults();
            } else if (data.action === "update_result") {
                // Mettre à jour les indices pour tous les joueurs
                currentStoryIndex = data.currentStoryIndex;
                currentContributionIndex = data.currentContributionIndex;
                showResults();
            } else if (data.message === "La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint") {
                alert("La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint.");
                window.location.href = "/dashboard";
            } else if (data.error) {
                alert(data.error);
            }
        };

        ws.onclose = function() {
            console.log("WebSocket connection closed for", username);
        };

        ws.onerror = function(error) {
            console.log("WebSocket error for", username, ":", error);
        };

    } catch (error) {
        console.error("Erreur lors du chargement du jeu:", error);
        const gameContent = document.getElementById("game-content");
        if (gameContent) {
            gameContent.innerHTML = "<p>Une erreur est survenue lors du chargement du jeu. Veuillez retourner au tableau de bord et réessayer.</p>";
            const returnButton = document.createElement("button");
            returnButton.textContent = "Retour au tableau de bord";
            returnButton.addEventListener("click", () => {
                window.location.href = "/dashboard";
            });
            gameContent.appendChild(returnButton);
        }
    }
});

// Mettre à jour la phase du jeu
function updateGamePhase(phase, currentRound) {
    const gameContent = document.getElementById("game-content");
    if (!gameContent) {
        console.error("Élément 'game-content' non trouvé dans le DOM");
        return;
    }
    gameContent.innerHTML = ""; // Vider le contenu précédent

    const phaseTitle = document.createElement("h2");
    phaseTitle.textContent = `Tour ${currentRound} - Phase: ${phase}`;
    gameContent.appendChild(phaseTitle);

    if (phase === "lobby") {
        const waitingMessage = document.createElement("p");
        waitingMessage.textContent = "En attente du démarrage du jeu...";
        gameContent.appendChild(waitingMessage);
    } else if (phase === "countdown") {
        const countdownMessage = document.createElement("p");
        countdownMessage.textContent = "Le jeu commence dans :";
        gameContent.appendChild(countdownMessage);

        const timerDisplay = document.createElement("p");
        timerDisplay.id = "timer-display";
        timerDisplay.textContent = `Temps restant: 3 secondes`;
        gameContent.appendChild(timerDisplay);
    }
}

// Gérer le début d'un tour
function startRound(phase, currentRound, timer, data, dataType) {
    const gameContent = document.getElementById("game-content");
    if (!gameContent) {
        console.error("Élément 'game-content' non trouvé dans le DOM");
        return;
    }
    gameContent.innerHTML = ""; // Vider le contenu précédent

    const phaseTitle = document.createElement("h2");
    phaseTitle.textContent = `Tour ${currentRound} - Phase: ${phase}`;
    gameContent.appendChild(phaseTitle);

    const timerDisplay = document.createElement("p");
    timerDisplay.id = "timer-display";
    timerDisplay.textContent = `Temps restant: ${timer} secondes`;
    gameContent.appendChild(timerDisplay);

    if (phase === "countdown") {
        const countdownMessage = document.createElement("p");
        countdownMessage.textContent = "Le jeu commence dans :";
        gameContent.appendChild(countdownMessage);
    } else if (phase === "draw") {
        console.log("Affichage de la phase 'draw' pour", username);
        const instruction = document.createElement("p");
        instruction.textContent = dataType === "text" ? data : "Dessinez ce que représente cette image :";
        gameContent.appendChild(instruction);

        if (dataType === "drawing") {
            const image = document.createElement("img");
            image.src = data;
            image.style.maxWidth = "400px";
            gameContent.appendChild(image);
        }

        // Créer le canvas
        const canvas = document.createElement("canvas");
        canvas.id = "drawing-canvas";
        canvas.width = 400;
        canvas.height = 300;
        canvas.style.border = "1px solid black";
        gameContent.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        let isDrawing = false;
        let isErasing = false;
        let currentColor = "black";
        let brushSize = 5;

        // Diviser le canvas en sections selon le nombre de joueurs
        const numPlayers = players.length;
        const sections = divideCanvas(numPlayers, canvas.width, canvas.height);
        console.log("Sections attribuées:", sections);

        // Attribuer une section au joueur actuel
        const playerIndex = players.indexOf(username);
        assignedSection = sections[playerIndex];
        console.log(`Section attribuée à ${username}:`, assignedSection);

        // Dessiner les bordures des sections et indiquer les joueurs
        sections.forEach((section, index) => {
            // Dessiner les bordures
            ctx.strokeStyle = "gray";
            ctx.lineWidth = 1;
            ctx.strokeRect(section.x, section.y, section.width, section.height);

            // Afficher le nom du joueur dans sa section
            ctx.fillStyle = "black";
            ctx.font = "12px Arial";
            ctx.fillText(players[index], section.x + 5, section.y + 15);
        });

        // Palette de couleurs
        const colorPalette = document.createElement("div");
        colorPalette.style.marginTop = "10px";
        const colors = [
            "black", "red", "blue", "green", "yellow", "purple", "orange",
            "cyan", "magenta", "brown", "pink", "lime", "teal", "indigo", "gray"
        ];
        colors.forEach(color => {
            const colorButton = document.createElement("button");
            colorButton.style.backgroundColor = color;
            colorButton.style.width = "30px";
            colorButton.style.height = "30px";
            colorButton.style.margin = "5px";
            colorButton.style.border = "1px solid #ccc";
            colorButton.style.cursor = "pointer";
            colorButton.addEventListener("click", () => {
                currentColor = color;
                isErasing = false;
                ctx.strokeStyle = currentColor;
                ctx.globalCompositeOperation = "source-over";
            });
            colorPalette.appendChild(colorButton);
        });
        gameContent.appendChild(colorPalette);

        // Bouton effaceur
        const eraserButton = document.createElement("button");
        eraserButton.textContent = "Effaceur";
        eraserButton.style.margin = "5px";
        eraserButton.addEventListener("click", () => {
            isErasing = true;
            ctx.globalCompositeOperation = "destination-out";
        });
        gameContent.appendChild(eraserButton);

        // Sélecteur de taille de pinceau/effaceur
        const sizeSelector = document.createElement("select");
        sizeSelector.style.margin = "5px";
        [2, 5, 10, 15, 20].forEach(size => {
            const option = document.createElement("option");
            option.value = size;
            option.textContent = `Taille ${size}`;
            if (size === brushSize) option.selected = true;
            sizeSelector.appendChild(option);
        });
        sizeSelector.addEventListener("change", (e) => {
            brushSize = parseInt(e.target.value);
            ctx.lineWidth = brushSize;
        });
        gameContent.appendChild(sizeSelector);

        // Initialiser le contexte du canvas
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";

        // Gestion du dessin (limité à la section attribuée)
        canvas.addEventListener("mousedown", (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Vérifier si le clic est dans la section attribuée
            if (
                x >= assignedSection.x &&
                x <= assignedSection.x + assignedSection.width &&
                y >= assignedSection.y &&
                y <= assignedSection.y + assignedSection.height
            ) {
                isDrawing = true;
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        });

        canvas.addEventListener("mousemove", (e) => {
            if (isDrawing) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Limiter le dessin à la section attribuée
                if (
                    x >= assignedSection.x &&
                    x <= assignedSection.x + assignedSection.width &&
                    y >= assignedSection.y &&
                    y <= assignedSection.y + assignedSection.height
                ) {
                    ctx.lineTo(x, y);
                    ctx.stroke();
                } else {
                    isDrawing = false; // Arrêter le dessin si on sort de la section
                }
            }
        });

        canvas.addEventListener("mouseup", () => {
            isDrawing = false;
        });

        canvas.addEventListener("mouseout", () => {
            isDrawing = false;
        });

        const submitButton = document.createElement("button");
        submitButton.textContent = "Soumettre le dessin";
        submitButton.style.marginTop = "10px";
        submitButton.addEventListener("click", () => {
            const drawingData = canvas.toDataURL();
            ws.send(JSON.stringify({
                action: "submit_drawing",
                drawing_data: drawingData
            }));
            gameContent.innerHTML = "<p>Dessin soumis, en attente des autres joueurs...</p>";
        });
        gameContent.appendChild(submitButton);
    } else if (phase === "guess") {
        console.log("Affichage de la phase 'guess' pour", username);
        const instruction = document.createElement("p");
        instruction.textContent = dataType === "drawing" ? "Devinez ce que représente ce dessin :" : "Devinez à partir de cette description :";
        gameContent.appendChild(instruction);

        if (dataType === "drawing") {
            const image = document.createElement("img");
            image.src = data;
            image.style.maxWidth = "400px";
            gameContent.appendChild(image);
        } else {
            const text = document.createElement("p");
            text.textContent = data;
            gameContent.appendChild(text);
        }

        const guessInput = document.createElement("input");
        guessInput.type = "text";
        guessInput.id = "guess-input";
        guessInput.placeholder = "Entrez votre devinette ici";
        gameContent.appendChild(guessInput);

        const submitButton = document.createElement("button");
        submitButton.textContent = "Soumettre";
        submitButton.addEventListener("click", () => {
            const guessInputElement = document.getElementById("guess-input");
            if (!guessInputElement) {
                console.error("Élément 'guess-input' non trouvé dans le DOM");
                return;
            }
            const guess = guessInputElement.value;
            if (guess) {
                ws.send(JSON.stringify({
                    action: "submit_phrase",
                    phrase: guess
                }));
                gameContent.innerHTML = "<p>Devinette soumise, en attente des autres joueurs...</p>";
            } else {
                alert("Veuillez entrer une devinette !");
            }
        });
        gameContent.appendChild(submitButton);
    } else {
        console.warn("Phase inconnue:", phase);
    }
}

// Fonction pour diviser le canvas en sections
function divideCanvas(numPlayers, canvasWidth, canvasHeight) {
    const sections = [];
    if (numPlayers <= 0) return sections;

    // Déterminer la disposition des sections (par exemple, en grille)
    const cols = Math.ceil(Math.sqrt(numPlayers));
    const rows = Math.ceil(numPlayers / cols);

    const sectionWidth = canvasWidth / cols;
    const sectionHeight = canvasHeight / rows;

    for (let i = 0; i < numPlayers; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        sections.push({
            x: col * sectionWidth,
            y: row * sectionHeight,
            width: sectionWidth,
            height: sectionHeight
        });
    }

    return sections;
}

// Mettre à jour le timer
function updateTimer(timer) {
    const timerDisplay = document.getElementById("timer-display");
    if (timerDisplay) {
        timerDisplay.textContent = `Temps restant: ${timer} secondes`;
    } else {
        console.warn("Élément 'timer-display' non trouvé dans le DOM");
    }
}

// Afficher les résultats
function showResults() {
    const gameContent = document.getElementById("game-content");
    if (!gameContent) {
        console.error("Élément 'game-content' non trouvé dans le DOM");
        return;
    }
    gameContent.innerHTML = ""; // Vider le contenu précédent

    const resultsTitle = document.createElement("h2");
    resultsTitle.textContent = "Résultats de la partie";
    gameContent.appendChild(resultsTitle);

    // Afficher l'histoire actuelle
    const player = playersOrder[currentStoryIndex];
    const contributions = playerData[player];

    const playerSection = document.createElement("div");
    playerSection.style.marginBottom = "20px";

    const playerTitle = document.createElement("h3");
    playerTitle.textContent = `Chaîne de ${player}`;
    playerSection.appendChild(playerTitle);

    // Afficher uniquement la contribution actuelle
    if (contributions[currentContributionIndex]) {
        const contribution = contributions[currentContributionIndex];
        const contributionElement = document.createElement("p");
        if (contribution.type === "drawing") {
            const img = document.createElement("img");
            img.src = contribution.value;
            img.style.maxWidth = "400px";
            contributionElement.appendChild(img);
        } else {
            contributionElement.textContent = `Devinette (Tour ${contribution.round}): ${contribution.value}`;
        }
        playerSection.appendChild(contributionElement);
    }

    gameContent.appendChild(playerSection);

    // Ajouter des boutons "Précédent" et "Suivant" uniquement pour le créateur
    if (username === creator) {
        const navButtons = document.createElement("div");
        navButtons.style.marginTop = "20px";

        const prevButton = document.createElement("button");
        prevButton.textContent = "Précédent";
        prevButton.addEventListener("click", () => {
            ws.send(JSON.stringify({
                action: "prev_result"
            }));
        });
        navButtons.appendChild(prevButton);

        const nextButton = document.createElement("button");
        nextButton.textContent = "Suivant";
        nextButton.style.marginLeft = "10px";
        nextButton.addEventListener("click", () => {
            ws.send(JSON.stringify({
                action: "next_result"
            }));
        });
        navButtons.appendChild(nextButton);

        gameContent.appendChild(navButtons);
    }

    // Ajouter un bouton pour retourner au tableau de bord
    const returnButton = document.createElement("button");
    returnButton.textContent = "Retour au tableau de bord";
    returnButton.style.marginTop = "20px";
    returnButton.addEventListener("click", () => {
        window.location.href = "/dashboard";
    });
    gameContent.appendChild(returnButton);
}