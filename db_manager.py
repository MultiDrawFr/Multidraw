# ===== Imports =====

from hashlib import sha256
from secrets import token_hex, token_urlsafe
from time import time
from bcrypt import hashpw, gensalt, checkpw

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, session

from db_init import LocalSession, Account, Tokens

# ===== DB Object Init =====

db = LocalSession()

# ===== DB Functions =====


def register_account(username: str, email: str, password: str) -> bool:
    newAccount = Account(username=username,
                     email=email,
                     password=hash_password(password))
    try:
        db.add(newAccount)
        db.commit()
        return True
    except IntegrityError as e:
        db.rollback()
        return False


def unregister_account(username: str, email: str) -> bool:
    toDeleteAccount = db.query(Account).filter_by(username=username,
                                                  email=email).first()
    if toDeleteAccount:
        db.delete(toDeleteAccount)
        db.commit()
        return True
    else:
        return False


def login_account(username: str, password: str) -> bool:
    if username and password:
        toLoginAccount = db.query(Account).filter_by(username=username).first()
        if toLoginAccount:
            return sha256(
                password.encode()).hexdigest() == toLoginAccount.password
        else:
            return False
    else:
        return False

def username_recovery(email: str):
    toLoginAccount = db.query(Account).filter_by(email=email).first()
    if toLoginAccount:
        return toLoginAccount.username
    else:
        return None


def password_recovery(username: str, newPassword: str):
    toLoginAccount = db.query(Account).filter_by(username=username).first()
    if toLoginAccount:
        toLoginAccount.password = sha256(  # type: ignore
            newPassword.encode()).hexdigest()
        db.commit()
        return True
    else:
        return False

def get_user_from_token(token: str):
    tokenInfos = db.query(Tokens.username, Tokens.datetime).filter_by(token = token).first()
    if not tokenInfos or tokenInfos[1] + 604800 <= time():
        return False
    return tokenInfos[0]

def generate_token(username: str):
    generatedToken = token_urlsafe(24)
    accountTokenInfos = db.query(Tokens.token, Tokens.datetime).filter_by(username=username).first()
    if not accountTokenInfos or accountTokenInfos[1] + 604800 <= time():
        generatedToken, tokenDatetime = token_urlsafe(24), round(time())
        if not accountTokenInfos:
            db.add(Tokens(username=username, token=generatedToken, datetime=round(time())))
        else:
            db.query(Tokens).filter_by(username=username).update({"token": generatedToken, "datetime": tokenDatetime})
        db.commit()
        return generatedToken
    return accountTokenInfos[0]

def hash_password(password: str) -> str:
    return hashpw(password.encode(), gensalt()).decode()

def check_password(password: str, hashed: str) -> bool:
    return checkpw(password.encode(), hashed.encode())

    


# ===== Execution =====

if __name__ == '__main__':
    print(get_user_from_token('zlt4VLnAEh7ow8M7lv83PoZo3wmS_HJB'))
