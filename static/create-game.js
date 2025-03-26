// Fonction pour récupérer un cookie par son nom (gardée pour d'autres cookies si besoin)
function getCookie(name) {
    const cookieName = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(cookieName)) {
            return cookie.substring(cookieName.length);
        }
    }
    return null;
}

window.addEventListener("load", async function() {
    try {
        const response = await fetch("/api/user", { 
            method: "GET",
            credentials: "include" // Inclut les cookies HttpOnly dans la requête
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        const username = data.username;
        const usernameDisplay = document.getElementById("username-display");
        usernameDisplay.textContent = username;
        window.currentUsername = username;
    } catch (error) {
        console.log("Erreur lors de la récupération du username:", error);
        document.getElementById("username-display").textContent = "Non connecté";
    }
});

document.getElementById("create-game-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value;
    const username = window.currentUsername;

    console.log("Nom de la partie:", name);
    console.log("Username récupéré:", username);

    // Validation
    if (!name || !username) {
        alert("Veuillez entrer un nom pour la partie et vous assurer que vous êtes connecté.");
        console.log("Erreur de validation - Nom de la partie ou utilisateur manquant");
        return;
    }

    try {
        const response = await fetch("/api/v1/games/new", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                name: name,
                username: username
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            alert("Erreur lors de la création de la partie");
            console.log("Erreur HTTP:", response.status, errorText);
            return;
        }

        const data = await response.json();
        console.log("Réponse du serveur:", data);

        // Afficher le lien de la partie
        const gameLink = `https://bookish-zebra-694qr94j467ph4w6w-8000.app.github.dev/join/${data.game_link}`;
        document.getElementById("game-link").textContent = gameLink;
        document.getElementById("game-link-container").style.display = "block";

        // Afficher le bouton "Aller au lobby" pour le créateur
        document.getElementById("go-to-lobby-button").style.display = "block";

        // Gestion du bouton "Copier le lien"
        document.getElementById("copy-link-button").addEventListener("click", function() {
            navigator.clipboard.writeText(gameLink).then(() => {
                alert("Lien copié dans le presse-papier !");
            }).catch(err => {
                console.log("Erreur lors de la copie:", err);
            });
        });

        // Gestion du bouton "Aller au lobby"
        document.getElementById("go-to-lobby-button").addEventListener("click", function() {
            window.location.href = `/lobby/${data.game_link}`;
        });

    } catch (error) {
        alert("Une erreur inattendue est survenue");
        console.log("Erreur lors de la requête:", error);
    }
});