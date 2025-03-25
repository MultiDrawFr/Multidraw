// Fonction pour récupérer un cookie par son nom
function getCookie(name) {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(name + '='))
        ?.split('=')[1];  // Utilisation de l'opérateur optional chaining pour éviter les erreurs si le cookie est introuvable
    return cookieValue;
}

document.getElementById("create-game-form").addEventListener("submit", async function (event) {
    event.preventDefault();  // Empêche la soumission classique du formulaire

    // Récupération du nom de la partie et du username depuis le cookie
    const name = document.getElementById("name").value;
    const username = getCookie("username");  // Utilisation d'une fonction pour extraire le cookie

    console.log("Nom de la partie:", name);
    console.log("Username récupéré du cookie:", username);  // Log pour vérifier si le cookie est bien récupéré

    // Vérification si le nom de la partie est fourni et si l'utilisateur est connecté
    if (!name || !username) {
        alert("Veuillez entrer un nom pour la partie et vous assurer que vous êtes connecté.");
        console.log("Erreur de validation - Nom de la partie ou utilisateur manquant");
        return;
    }

    // Envoi des données au backend pour créer la partie
    const response = await fetch("/api/v1/games/new", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: name,  // Nom de la partie
            username: username  // Envoi du username
        })
    });

    if (!response.ok) {
        alert("Erreur lors de la création de la partie");
        console.log("Erreur HTTP:", response.status, await response.text());  // Log pour plus d'infos
        return;
    }

    const data = await response.json();
    console.log("Réponse du serveur:", data);

    // Afficher le lien de la partie et le rendre copiable
    const gameLink = `http://localhost:8000/join/${data.game_link}`;
    document.getElementById("game-link").textContent = gameLink;
    document.getElementById("game-link-container").style.display = "block";

    // Fonction pour copier le lien
    document.getElementById("copy-link-button").addEventListener("click", function() {
        navigator.clipboard.writeText(gameLink).then(() => {
            alert("Lien copié dans le presse-papier !");
        });
    });
});
