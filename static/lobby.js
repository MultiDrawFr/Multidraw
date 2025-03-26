// Récupérer le game_link depuis l'URL
const gameLink = window.location.pathname.split('/lobby/')[1];
let ws; // Variable pour stocker la connexion WebSocket

window.addEventListener("load", async function() {
    try {
        // Vérifier si l'utilisateur est connecté
        const userResponse = await fetch("/api/user", {
            method: "GET",
            credentials: "include"
        });

        if (!userResponse.ok) {
            throw new Error("Utilisateur non connecté");
        }

        const userData = await userResponse.json();
        const username = userData.username;
        document.getElementById("username-display").textContent = username;

        // Afficher le lien de la partie
        const gameLinkUrl = `https://bookish-zebra-694qr94j467ph4w6w-8000.app.github.dev/join/${gameLink}`;
        document.getElementById("game-link").textContent = gameLinkUrl;

        // Gestion du bouton "Copier le lien"
        document.getElementById("copy-link-button").addEventListener("click", function() {
            navigator.clipboard.writeText(gameLinkUrl).then(() => {
                alert("Lien copié dans le presse-papier !");
            }).catch(err => {
                console.log("Erreur lors de la copie:", err);
            });
        });

        // Récupérer les informations initiales de la partie et rejoindre
        const gameResponse = await fetch(`/api/v1/games/join/${gameLink}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                username: username
            })
        });

        if (!gameResponse.ok) {
            throw new Error("Impossible de charger les informations de la partie");
        }

        const gameData = await gameResponse.json();
        document.getElementById("creator-name").textContent = gameData.creator;
        updatePlayersList(gameData.players);

        // Afficher le bouton "Commencer le jeu" uniquement pour le créateur
        if (username === gameData.creator) {
            document.getElementById("start-game-button").style.display = "inline-block";
        }

        // Établir une connexion WebSocket pour les mises à jour en temps réel
        ws = new WebSocket(`wss://bookish-zebra-694qr94j467ph4w6w-8000.app.github.dev/ws/${gameLink}/${username}`);
        
        ws.onopen = function() {
            console.log("WebSocket connection established for", username);
        };

        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log("Message WebSocket reçu par", username, ":", data);
            if (data.message === "La partie a été supprimée") {
                alert("La partie a été supprimée car tous les joueurs ont quitté.");
                window.location.href = "/dashboard";
                return;
            }
            if (data.message === "La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint") {
                console.log("La partie est vide, elle sera supprimée dans 5 minutes.");
                return;
            }
            if (data.action === "start_game") {
                // Rediriger tous les joueurs vers la page du jeu
                window.location.href = `/game/${gameLink}`;
                return;
            }
            // Mettre à jour le créateur et la liste des joueurs
            document.getElementById("creator-name").textContent = data.creator;
            updatePlayersList(data.players);
        };

        ws.onclose = function() {
            console.log("WebSocket connection closed for", username);
        };

        ws.onerror = function(error) {
            console.log("WebSocket error for", username, ":", error);
        };

        // Gestion du bouton "Commencer le jeu"
        document.getElementById("start-game-button").addEventListener("click", async function() {
            try {
                // Envoyer un message WebSocket pour démarrer le jeu
                ws.send(JSON.stringify({
                    action: "start_game"
                }));
            } catch (error) {
                console.log("Erreur lors du démarrage du jeu:", error);
                alert("Une erreur est survenue lors du démarrage du jeu: " + error.message);
            }
        });

        // Gestion du bouton "Quitter le salon"
        document.getElementById("leave-lobby-button").addEventListener("click", async function() {
            try {
                // Envoyer une requête pour quitter la partie
                const leaveResponse = await fetch(`/api/v1/games/leave/${gameLink}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        username: username
                    })
                });

                if (!leaveResponse.ok) {
                    const errorData = await leaveResponse.json();
                    throw new Error(`Erreur lors de la sortie de la partie: ${errorData.detail}`);
                }

                const leaveData = await leaveResponse.json();
                if (leaveData.message === "La partie a été supprimée car tous les joueurs ont quitté") {
                    alert("La partie a été supprimée car tous les joueurs ont quitté.");
                }

                // Fermer la connexion WebSocket
                if (ws) {
                    ws.close();
                }

                // Rediriger vers la page d'accueil ou une autre page
                window.location.href = "/dashboard";

            } catch (error) {
                console.log("Erreur lors de la sortie du lobby:", error);
                alert("Une erreur est survenue lors de la sortie du lobby: " + error.message);
            }
        });

    } catch (error) {
        console.log("Erreur lors du chargement du lobby:", error);
        window.location.href = "/login"; // Rediriger vers la page de connexion si erreur
    }
});

// Fonction pour mettre à jour la liste des joueurs
function updatePlayersList(players) {
    const playersList = document.getElementById("players-list");
    playersList.innerHTML = ""; // Vider la liste
    if (players && players.length > 0) {
        players.forEach(player => {
            if (player) { // S'assurer que le joueur n'est pas une chaîne vide
                const li = document.createElement("li");
                li.textContent = player;
                playersList.appendChild(li);
            }
        });
    }
}