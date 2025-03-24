# ===== Imports =====

from db_manager import login_account
from fastapi import FastAPI, Header
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from secrets import token_hex, token_urlsafe
import sys

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


@multidrawAPI.get('/api/v1/accounts/login/verify')
async def get_verify_account(request: Request):
    username = request.query_params.get('username')
    password = request.query_params.get('password')
    token = False
    
    if login_account(username, password):
        token = token_urlsafe(24)
    return {'token': token}


@multidrawAPI.post('/api/v1/accounts/register')
async def register_account(request: Request):
    pass
