import bcrypt


def hash_password(plain: str) -> str:
    data = plain.encode("utf-8")
    if len(data) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return bcrypt.hashpw(data, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    data = plain.encode("utf-8")
    if len(data) > 72:
        return False
    return bcrypt.checkpw(data, hashed.encode("utf-8"))


# JWT tokens, require_admin and require_member will be added later.
