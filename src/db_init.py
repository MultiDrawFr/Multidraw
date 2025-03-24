# ===== Imports =====

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base

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


class Tokens(Base):
    __tablename__ = "tokens"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    token = Column(String, unique=True, index=True)


# ===== DB Creation =====

Base.metadata.create_all(bind=engine)
