"""Create the first admin user. Run from the backend folder:  python create_admin.py"""
from getpass import getpass

from app.auth import hash_password
from app.database import SessionLocal
from app.models import Role, User

name = input("Admin name: ").strip()
email = input("Admin email: ").strip().lower()
password = getpass("Password (min 8 chars): ")

if len(password) < 8:
    raise SystemExit("Password too short.")

db = SessionLocal()
if db.query(User).filter(User.email == email).first():
    raise SystemExit("A user with that email already exists.")

db.add(User(name=name, email=email, password_hash=hash_password(password), role=Role.ADMIN))
db.commit()
print(f"Admin created: {email}")
