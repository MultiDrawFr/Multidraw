document.addEventListener("DOMContentLoaded", async function () {
    try {
        const response = await fetch("/api/user", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include"
        });

        if (response.status === 401) {
            // Si l'utilisateur n'est pas authentifié, redirige vers le login
            window.location.href = "/login";
            return;
        }

        if (!response.ok) {
            throw new Error("Erreur lors de la récupération des données utilisateur");
        }

        const userData = await response.json();
        
        // Log des données utilisateur pour déboguer
        console.log("Données utilisateur reçues :", userData);

        // Mise à jour du dashboard avec les données récupérées
        document.getElementById("username").textContent = userData.username;
        document.getElementById("email").textContent = userData.email;
        document.getElementById("games-played").textContent = userData.games_played;
        document.getElementById("total-score").textContent = userData.total_score;

    } catch (error) {
        console.error("Erreur dans le dashboard.js :", error);
        alert("Une erreur est survenue lors du chargement des données.");
        window.location.href = "/login";  // Redirige en cas d'erreur critique
    }
});

document.getElementById('logout-button').addEventListener("click", function() {
    document.cookie = "token=; expires=Thu, 01, Jan 1970 00:00:00 GMT; path=/";
    window.location.href = '/'
})