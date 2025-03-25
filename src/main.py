# ===== Imports =====

from db_manager import login_account
from fastapi import FastAPI, Header
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from secrets import token_hex, token_urlsafe
import sys
from db_init import Game, LocalSession, Account
from sqlalchemy.orm import Session
from fastapi import Cookie, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.responses import HTMLResponse
from uuid import uuid4
from fastapi import Response    

sys.setrecursionlimit(100)

# ===== API Inits =====

multidrawAPI = FastAPI()
multidrawAPI.mount('/static',
                   StaticFiles(directory="../static"),
                   name="static")
templates = Jinja2Templates(directory="../views")

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
async def get_test(request: Request):
    return templates.TemplateResponse("new-game.html", {'request': request})

########## DATABASE ##########

def get_db():
    db = LocalSession()
    try:
        yield db
    finally:
        db.close()

########## REGISTER ##########

@multidrawAPI.post('/api/v1/accounts/register')
async def register_account_api(request: Request, db: Session = Depends(get_db)):
    data = await request.json()

    # Vérification si l'utilisateur ou l'email existe déjà
    if db.query(Account).filter_by(username=data["username"]).first():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")
    if db.query(Account).filter_by(email=data["email"]).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    # Création du compte
    new_account = Account(username=data["username"], email=data["email"], password=data["password"], games_played=0, total_score=0)
    db.add(new_account)
    db.commit()

    return {"message": "Inscription réussie"}


########## LOGIN ##########

@multidrawAPI.get('/api/v1/accounts/login/verify')
async def get_verify_account(request: Request):
    username = request.query_params.get('username')
    password = request.query_params.get('password')
    token = False
    
    if login_account(username, password):
        token = token_urlsafe(24)
    return {'token': token}

@multidrawAPI.post('/api/v1/accounts/login')
async def login_account_api(request: Request, db: Session = Depends(get_db), response: Response = None):
    data = await request.json()
    
    user = db.query(Account).filter_by(username=data["username"]).first()
    
    if not user or user.password != data["password"]:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou mot de passe incorrect")
    
    # Ajout du username dans le cookie
    response.set_cookie(key="username", value=user.username, httponly=True, secure=False)  # https=True pour production

    return {"message": "Connexion réussie", "username": user.username}


@multidrawAPI.get("/api/user")
async def get_user(username: str = Cookie(None), db: Session = Depends(get_db)):
    if username is None:
        raise HTTPException(status_code=401, detail="Utilisateur non authentifié")
    
    user = db.query(Account).filter(Account.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return {
        "username": user.username,
        "email": user.email,
        "games_played": user.games_played,
        "total_score": user.total_score,
    }

########## NEW GAME / NEW-GAME ##########

@multidrawAPI.get("/new-game")
async def new_game_page(request: Request):
    # Récupérer les informations de l'utilisateur à partir de la session (cookies, etc.)
    username = request.cookies.get("username")
    email = request.cookies.get("email")

    if not username or not email:
        raise HTTPException(status_code=400, detail="Utilisateur non connecté")

    # Retourner la page de création de la partie avec les données de l'utilisateur
    return HTMLResponse(content=f"""
        <html>
            <body>
                <h1>Créer une nouvelle partie</h1>
                <form id="create-game-form">
                    <input type="text" id="name" placeholder="Nom de la partie" required />
                    <button type="submit">Créer la partie</button>
                </form>
                <p>Connecté en tant que {username} ({email})</p>
            </body>
        </html>
    """)

@multidrawAPI.post("/api/v1/games/new")
async def create_game(request: Request, db: Session = Depends(get_db)):
    try:
        # Récupérer les données envoyées
        data = await request.json()

        # Extraire le username envoyé dans la requête
        username = data.get("username")  # Récupère le username depuis le body de la requête

        print(f"Username récupéré depuis la requête: {username}")

        if not username:
            raise HTTPException(status_code=400, detail="Utilisateur non connecté")

        # Vérifier si l'utilisateur existe dans la base de données
        user = db.query(Account).filter_by(username=username).first()
        if not user:
            raise HTTPException(status_code=400, detail="Utilisateur non trouvé")

        # Créer un lien unique pour la partie
        game_link = str(uuid4())

        # Créer la partie dans la base de données
        new_game = Game(
            name=data["name"],
            creator=username,  # Utiliser le username de l'utilisateur comme créateur
            players=",".join([username]),  # Ajouter le créateur comme joueur
            link=game_link,
            is_full=False
        )
        db.add(new_game)
        db.commit()

        return {"message": "Partie créée avec succès", "game_link": game_link}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@multidrawAPI.post("/api/v1/games/join/{game_link}")
async def join_game(game_link: str, request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    user = db.query(Account).filter_by(username=data["username"]).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Utilisateur non trouvé")

    # Récupérer la partie via le lien
    game = db.query(Game).filter_by(link=game_link).first()

    if not game:
        raise HTTPException(status_code=404, detail="Partie non trouvée")

    if game.is_full:
        raise HTTPException(status_code=400, detail="La partie est pleine")

    players = game.players.split(",")
    if len(players) >= 4:
        game.is_full = True  # Marquer la partie comme pleine
        db.commit()
        raise HTTPException(status_code=400, detail="La partie est déjà complète")

    # Ajouter l'utilisateur à la liste des joueurs
    players.append(user.username)
    game.players = ",".join(players)

    # Si le nombre de joueurs atteint 4, marquer la partie comme pleine
    if len(players) == 4:
        game.is_full = True

    db.commit()

    return {"message": f"{user.username} a rejoint la partie"}

