// Récupérer le game_link et le username depuis l'URL
const gameLink = window.location.pathname.split('/game/')[1];
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');

let ws; // Variable pour stocker la connexion WebSocket
let creator; // Variable pour stocker le nom du créateur
let currentStoryIndex = 0; // Index de l'histoire actuelle
let currentContributionIndex = 0; // Index de la contribution actuelle dans l'histoire
let playerData; // Données des joueurs
let playersOrder; // Ordre des joueurs

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
                // Stocker le créateur pour savoir si l'utilisateur actuel est le créateur
                creator = data.creator;
            }

            if (data.action === "update_phase") {
                // Mettre à jour la phase du jeu
                console.log("Mise à jour de la phase:", data.phase, "Tour:", data.current_round);
                updateGamePhase(data.phase, data.current_round);
            } else if (data.action === "start_game") {
                // Gérer le début du jeu pour tous les joueurs
                console.log("Début du jeu pour", username, "- Phase:", data.phase);
                startRound(data.phase, data.current_round, data.timer, data.data || "");
            } else if (data.action === "start_round") {
                // Gérer le début d'un tour (hidden, draw, guess)
                console.log("Message start_round reçu:", { phase: data.phase, username: data.username });
                if (data.username === username) {
                    console.log("Début du tour pour", username, "- Phase:", data.phase);
                    startRound(data.phase, data.current_round, data.timer, data.data);
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
                currentStoryIndex = 0;
                currentContributionIndex = 0;
                showResults();
            } else if (data.action === "next_result") {
                // Passer à la contribution suivante
                currentContributionIndex++;
                if (currentContributionIndex >= playerData[playersOrder[currentStoryIndex]].length) {
                    currentStoryIndex++;
                    currentContributionIndex = 0;
                    if (currentStoryIndex >= playersOrder.length) {
                        currentStoryIndex = 0; // Revenir au début si on atteint la fin
                    }
                }
                showResults();
            } else if (data.action === "prev_result") {
                // Revenir à la contribution précédente
                currentContributionIndex--;
                if (currentContributionIndex < 0) {
                    currentStoryIndex--;
                    if (currentStoryIndex < 0) {
                        currentStoryIndex = playersOrder.length - 1; // Aller à la dernière histoire
                    }
                    currentContributionIndex = playerData[playersOrder[currentStoryIndex]].length - 1;
                }
                showResults();
            } else if (data.message === "La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint") {
                alert("La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint.");
                window.location.href = "/dashboard";
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
    } else if (phase === "hidden") {
        // Phase cachée, ne rien afficher
        const hiddenMessage = document.createElement("p");
        hiddenMessage.textContent = "Initialisation...";
        hiddenMessage.style.display = "none"; // Cacher le message
        gameContent.appendChild(hiddenMessage);
    }
}

// Gérer le début d'un tour
function startRound(phase, currentRound, timer, data) {
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

    if (phase === "hidden") {
        // Phase cachée, ne rien afficher
        const hiddenMessage = document.createElement("p");
        hiddenMessage.textContent = "Initialisation...";
        hiddenMessage.style.display = "none"; // Cacher le message
        gameContent.appendChild(hiddenMessage);
    } else if (phase === "draw") {
        console.log("Affichage de la phase 'draw' pour", username);
        const instruction = document.createElement("p");
        instruction.textContent = data || "Dessinez ce que vous voulez !";
        gameContent.appendChild(instruction);

        const canvas = document.createElement("canvas");
        canvas.id = "drawing-canvas";
        canvas.width = 400;
        canvas.height = 300;
        canvas.style.border = "1px solid black";
        gameContent.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        let isDrawing = false;

        canvas.addEventListener("mousedown", (e) => {
            isDrawing = true;
            ctx.beginPath();
            ctx.moveTo(e.offsetX, e.offsetY);
        });

        canvas.addEventListener("mousemove", (e) => {
            if (isDrawing) {
                ctx.lineTo(e.offsetX, e.offsetY);
                ctx.stroke();
            }
        });

        canvas.addEventListener("mouseup", () => {
            isDrawing = false;
        });

        const submitButton = document.createElement("button");
        submitButton.textContent = "Soumettre le dessin";
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
        instruction.textContent = "Devinez ce que représente ce dessin :";
        gameContent.appendChild(instruction);

        const image = document.createElement("img");
        image.src = data;
        image.style.maxWidth = "400px";
        gameContent.appendChild(image);

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