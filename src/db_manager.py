# ===== Imports =====

from hashlib import sha256
from secrets import token_hex

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, session

from db_init import LocalSession, Account, Tokens

# ===== DB Object Init =====

db = LocalSession()

# ===== DB Functions =====


def register_account(username: str, email: str, password: str) -> bool:
    newAccount = Account(username=username,
                         email=email,
                         password=sha256(password.encode()).hexdigest())
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


def login_account(username: str | None, password: str | None) -> bool:
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


def generate_token(username: str):
    generatedToken = token_hex(16)
    newToken = Tokens(username=username, token=generatedToken)
    


# ===== Execution =====

if __name__ == '__main__':
    print(register_account('test', 'test', 'test'))
    print(login_account('JudicaelAdmin', 'kevinjletape'))
    print(login_account('JudicaelAdmin', 'yanisjletape'))
