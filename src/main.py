# ===== Imports =====

from db_manager import login_account, generate_token, get_user_from_token
from fastapi import FastAPI, Header, WebSocket, WebSocketDisconnect
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from secrets import token_hex, token_urlsafe
import sys
from db_init import Game, LocalSession, Account, Base, Tokens
from sqlalchemy.orm import Session
from fastapi import Cookie, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.responses import HTMLResponse
from uuid import uuid4
from fastapi import Response  
from sqlalchemy.orm import sessionmaker 
from sqlalchemy import create_engine
from base64 import b64encode, b64decode
import json
import asyncio
import random
import os
from datetime import datetime, timedelta

sys.setrecursionlimit(100)

# ===== API Inits =====

multidrawAPI = FastAPI()
multidrawAPI.mount('/static',
                   StaticFiles(directory="../static"),
                   name="static")
templates = Jinja2Templates(directory="../views")

# ===== DATABASE =====

def get_db():
    db = LocalSession()
    try:
        yield db
    finally:
        db.close()

# ===== GAME CHECKING =====
async def cleanup_empty_games():
    while True:
        await asyncio.sleep(300)  # Attendre 5 minutes (300 secondes)
        print("Vérification des parties vides...")
        db = LocalSession()
        try:
            games = db.query(Game).all()
            for game in games:
                players = [p for p in (game.players.split(",") if game.players else []) if p]  # Nettoyer les chaînes vides
                if not players:  # Si la partie est vide
                    time_since_last_active = datetime.utcnow() - game.last_active
                    if time_since_last_active.total_seconds() >= 300:  # Si vide depuis plus de 5 minutes
                        print(f"Suppression de la partie {game.link} car elle est vide depuis plus de 5 minutes")
                        db.delete(game)
                        db.commit()
                        await manager.broadcast(game.link, {"message": "La partie a été supprimée"})
                else:
                    # Mettre à jour le timestamp si la partie n'est pas vide
                    game.last_active = datetime.utcnow()
                    game.players = ",".join(players)  # Mettre à jour la liste nettoyée
                    db.commit()
        except Exception as e:
            print(f"Erreur lors de la vérification des parties vides: {e}")
        finally:
            db.close()

# Lancer la tâche périodique au démarrage de l'application
@multidrawAPI.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_empty_games())

# ===== API Routes =====

@multidrawAPI.get("/")
async def get_index(request: Request):
    return templates.TemplateResponse("index.html", {'request': request})

@multidrawAPI.get('/login')
async def get_login(request: Request):
    return templates.TemplateResponse("login.html", {'request': request})

@multidrawAPI.get('/register')
async def get_signup(request: Request):
    return templates.TemplateResponse("register.html", {'request': request})

@multidrawAPI.get('/verify')
async def get_verif(request: Request):
    return templates.TemplateResponse("verify.html", {'request': request})

@multidrawAPI.get('/dashboard')
async def get_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {'request': request})

@multidrawAPI.get('/test')
async def get_test(request: Request):
    return templates.TemplateResponse("test.html", {'request': request})

@multidrawAPI.get('/game')
async def get_test(request: Request):
    return templates.TemplateResponse("game.html", {'request': request})

@multidrawAPI.get('/new-game')
async def get_new_game(request: Request):
    return templates.TemplateResponse("new-game.html", {'request': request})

@multidrawAPI.get('/join/{game_link}')
async def get_join_game(request: Request, game_link: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter_by(link=game_link).first()
    if not game:
        raise HTTPException(status_code=404, detail="Partie non trouvée")
    return templates.TemplateResponse("join-game.html", {'request': request, 'game_link': game_link})

# Route pour afficher la page du lobby
@multidrawAPI.get('/lobby/{game_link}')
async def get_lobby(request: Request, game_link: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter_by(link=game_link).first()
    if not game:
        raise HTTPException(status_code=404, detail="Partie non trouvée")
    return templates.TemplateResponse("lobby.html", {'request': request, 'game_link': game_link})

@multidrawAPI.get('/game/{game_link}')
async def get_game(request: Request, game_link: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter_by(link=game_link).first()
    if not game:
        raise HTTPException(status_code=404, detail="Partie non trouvée")
    return templates.TemplateResponse("game.html", {'request': request, 'game_link': game_link})

# Route pour gérer favicon.ico
@multidrawAPI.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)  # Retourne une réponse vide (No Content)

@multidrawAPI.post('/api/v1/accounts/register')
async def register_account_api(request: Request, db: Session = Depends(get_db)):
    data = await request.json()

    if db.query(Account).filter_by(username=data["username"]).first():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")
    if db.query(Account).filter_by(email=data["email"]).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    new_account = Account(username=data["username"], email=data["email"], password=data["password"], games_played=0, total_score=0)
    db.add(new_account)
    db.commit()

    return {"message": "Inscription réussie"}

@multidrawAPI.post('/api/v1/accounts/login')
async def login_account_api(request: Request, db: Session = Depends(get_db), response: Response = None):
    data = await request.json()
    user = db.query(Account).filter_by(username=data["username"]).first()
    if not user or user.password != data["password"]:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou mot de passe incorrect")

    token = generate_token(data["username"])
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=False,  # À changer à True en production
        samesite="Lax"
    )

    return {"message": "Connexion réussie", "user": user.username}

@multidrawAPI.get('/api/v1/login/verify')
async def verify_login(token: str = Cookie(None), db: Session = Depends(get_db)):
    user = get_user_from_token(token)
    if user == False:
        return {"message": "failed"}
    return {"message": "success"}

@multidrawAPI.get("/api/user")
async def get_user(token: str = Cookie(None), db: Session = Depends(get_db)):
    print(f"Requête /api/user - Token reçu: {token}")
    if token is None:
        print("Erreur: Aucun token fourni")
        raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
    
    username = db.query(Tokens.username).filter(Tokens.token == token).first()
    if not username:
        print(f"Erreur: Token non trouvé dans la base de données: {token}")
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    userInfos = db.query(Account).filter(Account.username == username[0]).first()
    print(f"Utilisateur trouvé: {userInfos.username}")
    return {
        "username": userInfos.username,
        "email": userInfos.email,
        "games_played": userInfos.games_played,
        "total_score": userInfos.total_score,
    }

@multidrawAPI.post("/api/v1/games/new")
async def create_game(request: Request, db: Session = Depends(get_db)):
    try:
        # Récupérer les données envoyées
        data = await request.json()

        # Extraire le username envoyé dans la requête
        username = data.get("username")  # Récupère le username depuis le body de la requête

        if not username:
            raise HTTPException(status_code=400, detail="Utilisateur non connecté")

        # Créer un lien unique pour la partie
        game_link = str(uuid4())

        # Créer la partie dans la base de données
        new_game = Game(
            name=data["name"],
            creator=username,  # Utiliser le username de l'utilisateur comme créateur
            original_creator=username,  # Définir le créateur initial
            players=",".join([username]),  # Ajouter le créateur comme joueur
            link=game_link,
            is_full=False,
            last_active=datetime.utcnow()
        )
        db.add(new_game)
        db.commit()

        return {"message": "Partie créée avec succès", "game_link": game_link}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@multidrawAPI.post("/api/v1/games/join/{game_link}")
async def join_game(game_link: str, request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    username = data.get("username")
    
    if not username:
        raise HTTPException(status_code=400, detail="Utilisateur non connecté")

    user = db.query(Account).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Utilisateur non trouvé")

    # Récupérer la partie via le lien
    game = db.query(Game).filter_by(link=game_link).first()
    if not game:
        raise HTTPException(status_code=404, detail="Partie non trouvée")

    if game.is_full:
        raise HTTPException(status_code=400, detail="La partie est pleine")

    players = [p for p in (game.players.split(",") if game.players else []) if p]  # Nettoyer les chaînes vides
    if username not in players:  # Ajouter le joueur s'il n'est pas déjà dans la liste
        players.append(username)
        game.players = ",".join(players)

        # Si le nombre de joueurs atteint 4, marquer la partie comme pleine
        if len(players) >= 4:
            game.is_full = True

        # Mettre à jour le timestamp de dernière activité
        game.last_active = datetime.utcnow()
        db.flush()  # Forcer la mise à jour dans la session
        db.commit()
        db.refresh(game)  # Rafraîchir l'objet game pour s'assurer qu'il est à jour

    # Diffuser la mise à jour à tous les clients connectés via WebSocket
    print(f"Diffusion de la mise à jour - Créateur: {game.creator}, Joueurs: {players}")
    await manager.broadcast(game_link, {"creator": game.creator, "players": players})

    return {"message": f"{username} a rejoint la partie", "creator": game.creator, "players": players}

# Route pour quitter une partie (via POST)
@multidrawAPI.post("/api/v1/games/leave/{game_link}")
async def leave_game(game_link: str, request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    username = data.get("username")

    if not username:
        raise HTTPException(status_code=400, detail="Utilisateur non connecté")

    # Récupérer la partie via le lien
    game = db.query(Game).filter_by(link=game_link).first()
    if not game:
        raise HTTPException(status_code=404, detail="Partie non trouvée")

    players = [p for p in (game.players.split(",") if game.players else []) if p]  # Nettoyer les chaînes vides
    if username not in players:
        return {"message": f"{username} n'est pas dans la partie"}

    # Retirer l'utilisateur de la liste des joueurs
    players.remove(username)

    # Si la liste des joueurs est vide, ne pas supprimer immédiatement, laisser la tâche périodique s'en charger
    if not players:
        game.players = ""
        game.last_active = datetime.utcnow()  # Mettre à jour le timestamp pour la vérification périodique
        db.commit()
        await manager.broadcast(game_link, {"message": "La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint"})
        return {"message": f"{username} a quitté la partie"}

    # Si le créateur quitte, désigner le premier joueur restant comme nouveau créateur
    if username == game.creator:
        game.creator = players[0]  # Le premier joueur restant devient le créateur

    game.players = ",".join(players)
    game.is_full = False  # Réinitialiser is_full si un joueur part
    game.last_active = datetime.utcnow()  # Mettre à jour le timestamp
    db.commit()

    # Diffuser la mise à jour à tous les clients connectés via WebSocket
    print(f"Diffusion de la mise à jour - Créateur: {game.creator}, Joueurs: {players}")
    await manager.broadcast(game_link, {"creator": game.creator, "players": players})

    return {"message": f"{username} a quitté la partie"}

# ===== Gestion des WebSockets pour le jeu (Gartic Phone) =====

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
        self.game_state: dict[str, dict] = {}  # Stocke l'état du jeu (phases, données des joueurs, etc.)

    async def connect(self, websocket: WebSocket, game_link: str, username: str):
        await websocket.accept()
        if game_link not in self.active_connections:
            self.active_connections[game_link] = []
        self.active_connections[game_link].append(websocket)
        print(f"{username} connected to WebSocket for game {game_link}")

    def disconnect(self, websocket: WebSocket, game_link: str, username: str, db: Session):
        if game_link in self.active_connections:
            self.active_connections[game_link].remove(websocket)
            if not self.active_connections[game_link]:
                del self.active_connections[game_link]

            # Retirer l'utilisateur de la liste des joueurs
            game = db.query(Game).filter_by(link=game_link).first()
            if game:
                players = [p for p in (game.players.split(",") if game.players else []) if p]  # Nettoyer les chaînes vides
                if username in players:
                    players.remove(username)

                    # Si la liste des joueurs est vide, ne pas supprimer immédiatement
                    if not players:
                        game.players = ""
                        game.last_active = datetime.utcnow()  # Mettre à jour le timestamp
                        db.commit()
                        self.broadcast(game_link, {"message": "La partie est vide, elle sera supprimée dans 5 minutes si personne ne rejoint"})
                        return

                    # Si le créateur quitte, désigner le premier joueur restant comme nouveau créateur
                    if username == game.creator:
                        game.creator = players[0]  # Le premier joueur restant devient le créateur

                    game.players = ",".join(players)
                    game.is_full = False  # Réinitialiser is_full si un joueur part
                    game.last_active = datetime.utcnow()  # Mettre à jour le timestamp
                    db.commit()

                    # Diffuser la mise à jour à tous les clients connectés
                    print(f"Diffusion de la mise à jour (déconnexion) - Créateur: {game.creator}, Joueurs: {players}")
                    self.broadcast(game_link, {"creator": game.creator, "players": players})

    async def broadcast(self, game_link: str, message: dict):
        if game_link in self.active_connections:
            print(f"Nombre de clients connectés pour {game_link}: {len(self.active_connections[game_link])}")
            for connection in self.active_connections[game_link]:
                try:
                    await connection.send_text(json.dumps(message))
                    print(f"Message envoyé à un client: {message}")
                except Exception as e:
                    print(f"Erreur lors de l'envoi via WebSocket: {e}")
                    self.active_connections[game_link].remove(connection)

manager = ConnectionManager()

# Endpoint WebSocket pour le lobby et le jeu
@multidrawAPI.websocket("/ws/{game_link}/{username}")
async def websocket_endpoint(websocket: WebSocket, game_link: str, username: str, db: Session = Depends(get_db)):
    await manager.connect(websocket, game_link, username)
    try:
        # Envoyer les informations initiales de la partie
        game = db.query(Game).filter_by(link=game_link).first()
        if game:
            players = [p for p in (game.players.split(",") if game.players else []) if p]  # Nettoyer les chaînes vides
            await websocket.send_text(json.dumps({"creator": game.creator, "players": players}))
            print(f"Informations initiales envoyées à {username}: creator={game.creator}, players={players}")

        # Initialiser l'état du jeu si nécessaire avec la phase "lobby"
        if game_link not in manager.game_state:
            manager.game_state[game_link] = {
                "phase": "lobby",  # Phase initiale : lobby (attente des joueurs)
                "timer": 0,  # Pas de timer actif dans la phase lobby
                "current_round": 0,  # Tour actuel (0 = lobby)
                "total_rounds": 6,  # Nombre total de tours (3 cycles de draw/guess)
                "player_data": {},  # Stocke les dessins et devinettes de chaque joueur
                "players_order": [],  # Ordre des joueurs pour la distribution des données
            }

        # Envoyer l'état initial de la phase au client
        print(f"Envoyer l'état initial à {username} pour la partie {game_link}: phase={manager.game_state[game_link]['phase']}")
        await websocket.send_text(json.dumps({
            "action": "update_phase",
            "phase": manager.game_state[game_link]["phase"],
            "current_round": manager.game_state[game_link]["current_round"]
        }))

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(f"Message reçu de {username} dans la partie {game_link}: {message}")

            if message.get("action") == "start_game":
                # Vérifier que l'utilisateur est le créateur
                game = db.query(Game).filter_by(link=game_link).first()
                if username != game.creator:
                    await websocket.send_text(json.dumps({"error": "Seul le créateur peut démarrer le jeu"}))
                    print(f"{username} a essayé de démarrer le jeu mais n'est pas le créateur")
                    continue

                # Recharger l'objet game pour s'assurer que les données sont à jour
                db.refresh(game)
                print(f"Après refresh - Valeur brute de game.players: '{game.players}'")

                # Récupérer la liste des joueurs et déboguer
                players = [p for p in (game.players.split(",") if game.players else []) if p]
                print(f"Liste des joueurs avant vérification: {players}, nombre: {len(players)}")
                print(f"Valeur brute de game.players: '{game.players}'")

                # Vérifier le nombre de joueurs
                if len(players) < 2:
                    await websocket.send_text(json.dumps({"error": "Il faut au moins 2 joueurs pour démarrer le jeu"}))
                    print(f"Le jeu ne peut pas démarrer : {len(players)} joueurs, minimum 2 requis")
                    continue

                # Initialiser l'ordre des joueurs
                manager.game_state[game_link]["players_order"] = players
                for player in players:
                    manager.game_state[game_link]["player_data"][player] = []

                # Passer à une phase "hidden" pour initialiser le jeu (0.1 seconde)
                manager.game_state[game_link]["current_round"] = 0
                manager.game_state[game_link]["phase"] = "hidden"
                manager.game_state[game_link]["timer"] = 0.1  # 0.1 seconde

                # Diffuser un message pour démarrer le jeu
                print(f"Diffusion de start_game pour la partie {game_link}, phase=hidden, joueurs connectés: {len(manager.active_connections.get(game_link, []))}")
                await manager.broadcast(game_link, {
                    "action": "start_game",
                    "phase": "hidden",
                    "current_round": 0,
                    "timer": manager.game_state[game_link]["timer"]
                })

                # Envoyer un message start_round à chaque joueur pour la phase hidden
                for player in players:
                    try:
                        await manager.broadcast(game_link, {
                            "action": "start_round",
                            "phase": "hidden",
                            "current_round": 0,
                            "timer": 0.1,
                            "data": "",
                            "username": player
                        })
                        print(f"Message start_round envoyé à {player} pour la phase hidden")
                    except Exception as e:
                        print(f"Erreur lors de l'envoi de start_round à {player}: {e}")

            elif message.get("action") == "submit_drawing":
                # S'assurer que le jeu est dans la phase "draw"
                if manager.game_state[game_link]["phase"] != "draw":
                    await websocket.send_text(json.dumps({"error": "Le jeu n'est pas dans la phase de dessin"}))
                    continue

                # Enregistrer le dessin du joueur
                drawing_data = message.get("drawing_data")
                round_data = {
                    "type": "drawing",
                    "value": drawing_data,
                    "player": username,
                    "round": manager.game_state[game_link]["current_round"]
                }
                manager.game_state[game_link]["player_data"][username].append(round_data)
                print(f"Dessin soumis par {username}")

                # Vérifier si tous les joueurs ont soumis leur dessin
                game = db.query(Game).filter_by(link=game_link).first()
                players = [p for p in (game.players.split(",") if game.players else []) if p]
                all_submitted = all(
                    len(manager.game_state[game_link]["player_data"][player]) >= manager.game_state[game_link]["current_round"]
                    for player in players
                )

                if all_submitted:
                    await start_next_round(game_link, db)

            elif message.get("action") == "submit_phrase":
                # S'assurer que le jeu est dans la phase "guess"
                if manager.game_state[game_link]["phase"] != "guess":
                    await websocket.send_text(json.dumps({"error": "Le jeu n'est pas dans la phase de devinette"}))
                    continue

                # Enregistrer la devinette du joueur
                phrase = message.get("phrase")
                round_data = {
                    "type": "guess",
                    "value": phrase,
                    "player": username,
                    "round": manager.game_state[game_link]["current_round"]
                }
                manager.game_state[game_link]["player_data"][username].append(round_data)
                print(f"Devinette soumise par {username}: {phrase}")

                # Vérifier si tous les joueurs ont soumis leur devinette
                game = db.query(Game).filter_by(link=game_link).first()
                players = [p for p in (game.players.split(",") if game.players else []) if p]
                all_submitted = all(
                    len(manager.game_state[game_link]["player_data"][player]) >= manager.game_state[game_link]["current_round"]
                    for player in players
                )

                if all_submitted:
                    await start_next_round(game_link, db)

            elif message.get("action") == "next_result":
                # Vérifier que l'utilisateur est le créateur
                game = db.query(Game).filter_by(link=game_link).first()
                if username != game.creator:
                    await websocket.send_text(json.dumps({"error": "Seul le créateur peut passer au résultat suivant"}))
                    continue

                # Diffuser un message pour passer au résultat suivant
                await manager.broadcast(game_link, {
                    "action": "next_result"
                })

            elif message.get("action") == "prev_result":
                # Vérifier que l'utilisateur est le créateur
                game = db.query(Game).filter_by(link=game_link).first()
                if username != game.creator:
                    await websocket.send_text(json.dumps({"error": "Seul le créateur peut revenir au résultat précédent"}))
                    continue

                # Diffuser un message pour revenir au résultat précédent
                await manager.broadcast(game_link, {
                    "action": "prev_result"
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket, game_link, username, db)
        print(f"{username} disconnected from WebSocket for game {game_link}")

async def start_next_round(game_link: str, db: Session):
    state = manager.game_state[game_link]
    state["current_round"] += 1

    if state["current_round"] > state["total_rounds"]:
        # Fin du jeu, afficher les résultats
        state["phase"] = "result"
        await manager.broadcast(game_link, {
            "action": "show_result",
            "player_data": state["player_data"],
            "players_order": state["players_order"]
        })
        print(f"Fin du jeu pour {game_link}, passage à la phase result")
    else:
        # Déterminer la phase du tour suivant
        if state["current_round"] == 1:
            state["phase"] = "draw"
            state["timer"] = 60  # 60 secondes pour dessiner
        elif state["current_round"] % 2 == 0:
            state["phase"] = "guess"
            state["timer"] = 30  # 30 secondes pour deviner
        else:
            state["phase"] = "draw"
            state["timer"] = 60  # 60 secondes pour dessiner

        # Distribuer les données aux joueurs
        players_order = state["players_order"]
        for i, player in enumerate(players_order):
            # Le joueur reçoit les données du joueur précédent
            prev_player = players_order[(i - 1) % len(players_order)]
            prev_data = state["player_data"][prev_player][-1]["value"] if state["player_data"][prev_player] else "Dessinez ce que vous voulez !"

            # Envoyer les données au joueur
            try:
                await manager.broadcast(game_link, {
                    "action": "start_round",
                    "phase": state["phase"],
                    "current_round": state["current_round"],
                    "timer": state["timer"],
                    "data": prev_data,
                    "username": player
                })
                print(f"Message start_round envoyé à {player}: phase={state['phase']}")
            except Exception as e:
                print(f"Erreur lors de l'envoi de start_round à {player}: {e}")

# Tâche périodique pour gérer les timers du jeu
async def game_timer():
    while True:
        await asyncio.sleep(0.1)  # Vérifier toutes les 0.1 secondes pour gérer la phase hidden
        for game_link, state in manager.game_state.items():
            # Ne gérer le timer que si la phase est "hidden", "draw" ou "guess"
            if state["phase"] in ["hidden", "draw", "guess"] and state["timer"] > 0:
                state["timer"] -= 0.1
                await manager.broadcast(game_link, {
                    "action": "update_timer",
                    "timer": state["timer"]
                })
                if state["timer"] <= 0:
                    # Fin du temps, passer au tour suivant
                    state["current_round"] += 1
                    if state["current_round"] > state["total_rounds"]:
                        # Fin du jeu, afficher les résultats
                        state["phase"] = "result"
                        await manager.broadcast(game_link, {
                            "action": "show_result",
                            "player_data": state["player_data"],
                            "players_order": state["players_order"]
                        })
                    else:
                        # Déterminer la phase du tour suivant
                        if state["current_round"] == 1:
                            state["phase"] = "draw"
                            state["timer"] = 60  # 60 secondes pour dessiner
                        elif state["current_round"] % 2 == 0:
                            state["phase"] = "guess"
                            state["timer"] = 30  # 30 secondes pour deviner
                        else:
                            state["phase"] = "draw"
                            state["timer"] = 60  # 60 secondes pour dessiner

                        # Distribuer les données aux joueurs
                        players_order = state["players_order"]
                        for i, player in enumerate(players_order):
                            # Le joueur reçoit les données du joueur précédent
                            prev_player = players_order[(i - 1) % len(players_order)]
                            prev_data = state["player_data"][prev_player][-1]["value"] if state["player_data"][prev_player] else "Dessinez ce que vous voulez !"

                            # Envoyer les données au joueur
                            try:
                                await manager.broadcast(game_link, {
                                    "action": "start_round",
                                    "phase": state["phase"],
                                    "current_round": state["current_round"],
                                    "timer": state["timer"],
                                    "data": prev_data,
                                    "username": player
                                })
                                print(f"Message start_round envoyé à {player}: phase={state['phase']}")
                            except Exception as e:
                                print(f"Erreur lors de l'envoi de start_round à {player}: {e}")

# Lancer la tâche périodique pour le timer du jeu
@multidrawAPI.on_event("startup")
async def start_game_timer():
    asyncio.create_task(game_timer())