# ===== Imports =====

from sqlalchemy import Boolean, create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

# ===== DB Inits =====

SQLALCHEMY_DATABASE_URL = "sqlite:///../data/multidrawDB.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False})
LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ===== DB Models =====

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String, unique=False, index=True)
    games_played = Column(Integer, default=0)
    total_score = Column(Integer, default=0)

class Tokens(Base):
    __tablename__ = "tokens"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    token = Column(String, unique=True, index=True)
    datetime = Column(Integer, unique=False, index=True)

class Game(Base):
    __tablename__ = "games"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    creator = Column(String, index=True)  # Créateur actuel de la partie
    original_creator = Column(String, index=True)  # Créateur initial de la partie
    players = Column(String)  # Liste des joueurs (max 4)
    link = Column(String, unique=True)  # Lien pour rejoindre la partie
    is_full = Column(Boolean, default=False)  # Si la partie est pleine
    last_active = Column(DateTime, default=datetime.utcnow)  # Timestamp de la dernière activité
    drawings = Column(String, default="")  # Stockage des dessins (JSON sous forme de chaîne)
    


# ===== DB Creation =====

Base.metadata.create_all(bind=engine)