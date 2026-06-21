"""Reset (or create) an owner/admin login when you are locked out.

Run this on the BACKEND host (the server that runs the API), from the backend
directory, after activating its environment. It talks directly to the same
database the API uses.

Usage (arguments):
    python -m scripts.reset_admin_password <username> <new_password>

Usage (environment variables, keeps the password out of shell history):
    RESET_USERNAME=admin RESET_PASSWORD='YourNewPass123' python -m scripts.reset_admin_password

Behaviour:
    - If the user exists, its password is reset and the account is made active.
    - If the user does not exist, an OWNER account is created with that password.
    - The password must be at least 8 characters and not a known demo password.

This only changes the one account's password; no other data is touched.
"""

import os
import sys

# Make `app` importable whether run as `python -m scripts.reset_admin_password`
# from the backend dir or as `python scripts/reset_admin_password.py`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select  # noqa: E402

from app.database import engine  # noqa: E402
from app.models import User, UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402

DEMO_PASSWORDS = {"admin123", "booker123"}


def main() -> int:
    if len(sys.argv) >= 3:
        username, password = sys.argv[1], sys.argv[2]
    else:
        username = os.getenv("RESET_USERNAME", "")
        password = os.getenv("RESET_PASSWORD", "")

    username = (username or "").strip()
    if not username or not password:
        print("Provide a username and password (args or RESET_USERNAME / RESET_PASSWORD).")
        return 1
    if len(password) < 8 or password in DEMO_PASSWORDS:
        print("Refusing weak/demo password: use at least 8 characters and not a demo password.")
        return 1

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if user:
            user.hashed_password = hash_password(password)
            user.is_active = True
            session.add(user)
            session.commit()
            print(f"Password reset for existing user '{username}' (role {user.role.value}).")
        else:
            user = User(name="Owner Admin", username=username, hashed_password=hash_password(password), role=UserRole.OWNER)
            session.add(user)
            session.commit()
            print(f"Created new OWNER user '{username}'.")
    print("Done. You can now log in with the new password and change it in Settings.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
