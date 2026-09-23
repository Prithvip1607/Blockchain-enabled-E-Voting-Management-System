"""Create an administrator account (or promote an existing user).

    python -m backend.create_admin                # prompts for a new admin's ID and password
    python -m backend.create_admin --promote bob  # promote an existing voter to admin

The password is read with getpass, never from the command line or source code.
This is an APPLICATION admin. Blockchain administration is decided by the smart contract
owner (the wallet that deployed Voting.sol), not by this role.
"""
from __future__ import annotations

import argparse
import getpass
import sys

from dotenv import load_dotenv
from sqlalchemy import select

from . import main as app_main  # loads .env
from .database import User, get_db, init_db
from .security import hash_password


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--promote", metavar="VOTER_ID", help="promote an existing user to admin")
    args = parser.parse_args()

    load_dotenv(app_main.ROOT / ".env")
    init_db()
    db = next(get_db())

    if args.promote:
        user = db.scalar(select(User).where(User.voter_id == args.promote))
        if not user:
            print(f"No such voter: {args.promote}", file=sys.stderr)
            return 1
        user.role = "admin"
        db.commit()
        print(f"{user.voter_id} is now an administrator.")
        return 0

    voter_id = input("Admin ID (3-32 characters, no spaces): ").strip()
    if not (3 <= len(voter_id) <= 32) or " " in voter_id:
        print("Invalid ID.", file=sys.stderr)
        return 1
    if db.scalar(select(User).where(User.voter_id == voter_id)):
        print("That ID already exists. Use --promote to make it an admin.", file=sys.stderr)
        return 1
    pw = getpass.getpass("Password (6-72 characters): ")
    if pw != getpass.getpass("Repeat password: "):
        print("Passwords do not match.", file=sys.stderr)
        return 1
    if not (6 <= len(pw.encode()) <= 72):
        print("Password must be 6-72 bytes.", file=sys.stderr)
        return 1
    db.add(User(voter_id=voter_id, password_hash=hash_password(pw), role="admin"))
    db.commit()
    print(f"Admin '{voter_id}' created.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
