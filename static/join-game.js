// Récupérer le game_link depuis l'URL
const gameLink = window.location.pathname.split('/join/')[1];

window.addEventListener("load", async function() {
    const joinButton = document.getElementById("join-button");
    joinButton.style.display = "none"; // Cacher le bouton initialement

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
        window.currentUsername = username;

        // Afficher le message de statut
        document.getElementById("join-message").style.display = "block";

        // Vérifier l'état de la partie
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
            const errorText = await gameResponse.text();
            const errorData = JSON.parse(errorText);
            if (errorData.detail === "La partie est pleine" || errorData.detail === "La partie est déjà complète") {
                document.getElementById("join-status").textContent = "Désolé, la partie est pleine.";
            } else if (errorData.detail === "Partie non trouvée") {
                document.getElementById("join-status").textContent = "Partie non trouvée.";
            } else {
                document.getElementById("join-status").textContent = "Une erreur est survenue.";
            }
            return;
        }

        // Si la requête est réussie, afficher le bouton pour rejoindre
        document.getElementById("join-status").textContent = "Vous pouvez rejoindre cette partie !";
        joinButton.style.display = "block";

        // Gestion du bouton "Rejoindre la partie"
        joinButton.addEventListener("click", function() {
            // Rediriger directement vers la page du lobby
            window.location.href = `/lobby/${gameLink}`;
        });

    } catch (error) {
        console.log("Erreur lors de la vérification:", error);
        document.getElementById("username-display").textContent = "Non connecté";
        document.getElementById("join-message").style.display = "block";
        document.getElementById("join-status").textContent = "Veuillez vous connecter pour rejoindre la partie.";
        document.getElementById("login-link").style.display = "block";
    }
});