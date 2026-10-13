"""Shared auth + tenancy dependencies for Phase 1.

- Verifies Supabase JWT via service-role client (sb.auth.get_user).
- Resolves institute memberships server-side. Never trusts client role/institute_id.
"""
from fastapi import Header, HTTPException

from app.database import get_supabase


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail="Backend me SUPABASE_SERVICE_KEY nahi hai. backend/.env me service_role key dalo aur restart karo.",
        ) from e


def verify_bearer_token(authorization: str | None) -> dict:
    """Return {id, email} or raise 401. Expects 'Bearer <jwt>'."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty Bearer token")
    sb = _sb_or_503()
    try:
        res = sb.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}") from e
    user = res.user if hasattr(res, "user") else None
    if not user:
        raise HTTPException(status_code=401, detail="Token invalid ya expired — dobara login karo")
    uid = user.id if hasattr(user, "id") else ""
    email = (user.email if hasattr(user, "email") else "") or ""
    if not uid:
        raise HTTPException(status_code=401, detail="Token invalid")
    return {"id": uid, "email": email}


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    return verify_bearer_token(authorization)


def get_user_memberships(user_id: str) -> list[dict]:
    sb = _sb_or_503()
    mem = (
        sb.table("institute_members")
        .select("institute_id,role,institutes(id,name,plan)")
        .eq("user_id", user_id)
        .execute()
    )
    return mem.data or []


def require_institute_membership(institute_id: str, user_id: str) -> dict:
    """Return membership row or raise 403. Source of truth = institute_members table."""
    if not institute_id:
        raise HTTPException(status_code=400, detail="institute_id required")
    sb = _sb_or_503()
    res = (
        sb.table("institute_members")
        .select("institute_id,role")
        .eq("institute_id", institute_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=403, detail="Is institute ka access nahi hai")
    return rows[0]


def require_staff(institute_id: str, user_id: str) -> dict:
    """Owner/teacher/staff only. Students/parents blocked."""
    mem = require_institute_membership(institute_id, user_id)
    if mem.get("role") not in ("owner", "teacher", "staff"):
        raise HTTPException(status_code=403, detail="Staff access required")
    return mem


def require_owner_or_staff(institute_id: str, user_id: str) -> dict:
    mem = require_institute_membership(institute_id, user_id)
    if mem.get("role") not in ("owner", "staff"):
        raise HTTPException(status_code=403, detail="Owner/staff access required")
    return mem


def require_batch_access(institute_id: str, batch_id: str, user_id: str) -> dict:
    """Owner/staff pass always. Teachers must be assigned via batch_teachers."""
    mem = require_institute_membership(institute_id, user_id)
    if mem.get("role") in ("owner", "staff"):
        return mem
    if mem.get("role") == "teacher":
        sb = _sb_or_503()
        hit = (
            sb.table("batch_teachers")
            .select("batch_id")
            .eq("batch_id", batch_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if hit.data:
            return mem
        raise HTTPException(status_code=403, detail="Assigned batches only")
    raise HTTPException(status_code=403, detail="Staff access required")


def teacher_batch_ids(institute_id: str, user_id: str) -> list[str] | None:
    """None = full access (owner/staff). List = teacher's assigned batches."""
    mem = require_institute_membership(institute_id, user_id)
    if mem.get("role") in ("owner", "staff"):
        return None
    if mem.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Staff access required")
    sb = _sb_or_503()
    rows = (
        sb.table("batch_teachers")
        .select("batch_id,batches!inner(institute_id)")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    return [r["batch_id"] for r in rows if (r.get("batches") or {}).get("institute_id") == institute_id]
