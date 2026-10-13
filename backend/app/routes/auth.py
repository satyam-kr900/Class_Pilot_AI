from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from app.database import first_row, get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/health")
def health():
    return {"status": "ok", "note": "Auth Supabase Auth se hota hai; backend service-role se verify karta hai."}


class TokenIn(BaseModel):
    access_token: str | None = None


def _sb_or_503():
    """Service key missing ho to 500 ki jagah saaf 503 do (frontend isServerFault samjhega)."""
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(
            503,
            "Backend me SUPABASE_SERVICE_KEY nahi hai. backend/.env me service_role key dalo "
            "(Dashboard → Project Settings → API) aur backend restart karo.",
        ) from e


def _verify_token(access_token: str | None, authorization: str | None):
    token = (access_token or "").strip()
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "access_token bhejo (body ya Bearer header me)")
    sb = _sb_or_503()
    try:
        res = sb.auth.get_user(token)
    except Exception as e:
        raise HTTPException(401, f"Token invalid: {e}")
    user = res.user if hasattr(res, "user") else res.get("user") if isinstance(res, dict) else None
    if not user:
        raise HTTPException(401, "Token invalid ya expired — dobara login karo")
    uid = user.id if hasattr(user, "id") else user.get("id")
    email = (user.email if hasattr(user, "email") else user.get("email")) or ""
    return {"id": uid, "email": email}


@router.post("/verify")
def verify(payload: TokenIn, authorization: str | None = Header(default=None)):
    """Login ke baad frontend/mobile yahi bhejta hai — backend token verify karta hai."""
    user = _verify_token(payload.access_token, authorization)
    return {"verified": True, "user_id": user["id"], "email": user["email"]}


@router.post("/register")
def register(payload: TokenIn, authorization: str | None = Header(default=None)):
    """Signup ke baad: token verify + pehli baar default institute + owner membership."""
    user = _verify_token(payload.access_token, authorization)
    sb = _sb_or_503()
    institute = None
    try:
        mem = sb.table("institute_members").select("institute_id").eq("user_id", user["id"]).limit(1).execute()
        rows = mem.data or []
        if rows:
            inst = sb.table("institutes").select("*").eq("id", rows[0]["institute_id"]).execute()
            institute = first_row(inst)
        else:
            name = f"{(user['email'] or 'My').split('@')[0]}'s Institute"
            created = sb.table("institutes").insert({"name": name, "owner_id": user["id"]}).select().execute()
            institute = first_row(created)
            if institute:
                sb.table("institute_members").insert({
                    "institute_id": institute["id"],
                    "user_id": user["id"],
                    "role": "owner",
                }).execute()
    except Exception as e:
        # institutes tables na hon (purana project) to sirf verify karke lautao
        return {"verified": True, "user_id": user["id"], "email": user["email"], "institute": None, "note": f"institute skip: {e}"}
    return {"verified": True, "user_id": user["id"], "email": user["email"], "institute": institute}


class FindAccountIn(BaseModel):
    institute_name: str
    student_name: str
    mobile: str
    who: str = "parent"  # parent | student


_rate: dict[str, list[float]] = {}


def _mask_email(email: str) -> str:
    try:
        local, domain = email.split("@", 1)
        return (local[:1] + "***@" + domain) if local else "***@" + domain
    except Exception:
        return "***"


@router.post("/find-account")
def find_account(payload: FindAccountIn, request: Request):
    """Mobile se account dhoondo — token nahi deta, sirf login email ka hint.

    Parent: institute + student + PARENT mobile (guardian_phone).
    Student: institute + apna naam + PERSONAL mobile (student_phone).
    Exact match chahiye; galat hone par generic 404 (enumeration-proof).
    Rate limit: 20/hour per IP (best-effort, reload par reset).
    """
    import time

    if payload.who not in ("parent", "student"):
        raise HTTPException(400, "who must be parent|student (teachers email se login karein)")
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [t for t in _rate.get(ip, []) if now - t < 3600]
    if len(hits) >= 20:
        raise HTTPException(429, "Bahut try ho gaye — 1 ghante baad try karo")
    hits.append(now)
    _rate[ip] = hits

    digits = "".join(c for c in (payload.mobile or "") if c.isdigit())[-10:]
    if len(digits) != 10:
        raise HTTPException(400, "10-digit mobile number dalo")
    sb = _sb_or_503()
    NOMATCH = "Match nahi hua — institute/naam/mobile check karo"

    inst_rows = (
        sb.table("institutes").select("id,name").ilike("name", f"%{payload.institute_name.strip()}%").limit(5).execute().data or []
    )
    if len(inst_rows) != 1:
        raise HTTPException(404, NOMATCH if not inst_rows else "Ek se zyada institute mile — poora exact naam likho")
    inst = inst_rows[0]

    phone_col = "guardian_phone" if payload.who == "parent" else "student_phone"
    stud = first_row(
        sb.table("students")
        .select("id,name,user_id")
        .eq("institute_id", inst["id"])
        .ilike("name", f"%{payload.student_name.strip()}%")
        .eq(phone_col, digits)
        .limit(2)
        .execute()
    )
    if not stud:
        raise HTTPException(404, NOMATCH)

    # Linked auth account nikalo
    linked_uid: str | None = None
    if payload.who == "student":
        linked_uid = stud.get("user_id")
    else:
        sg = sb.table("student_guardians").select("guardian_id").eq("student_id", stud["id"]).execute().data or []
        gids = [x["guardian_id"] for x in sg]
        if gids:
            g = sb.table("guardians").select("user_id").in_("id", gids).execute().data or []
            linked_uid = next((x.get("user_id") for x in g if x.get("user_id")), None)
    if not linked_uid:
        return {
            "found": True,
            "linked": False,
            "institute": {"id": inst["id"], "name": inst["name"]},
            "student": stud["name"],
            "note": "Record mil gaya, par login account link nahi hai — institute office se account linking mango, phir yehi mobile se dobara dhoondo.",
        }
    try:
        u = sb.auth.admin.get_user_by_id(linked_uid)
        user_obj = getattr(u, "user", None) or (u.get("user") if isinstance(u, dict) else None)
        email = (getattr(user_obj, "email", None) or (user_obj.get("email") if isinstance(user_obj, dict) else None)) or ""
    except Exception:
        email = ""
    return {
        "found": True,
        "linked": True,
        "institute": {"id": inst["id"], "name": inst["name"]},
        "student": stud["name"],
        "role": payload.who,
        "login_email_masked": _mask_email(email) if email else "",
        "note": "Upar wali email se /login pe jao. Full email yaad na ho to institute office se pucho.",
    }
