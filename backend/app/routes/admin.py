"""Admin panel API — owner/staff add teachers, students, parents + issue logins.

Flow: admin fills details -> backend creates Supabase Auth user (email confirmed)
+ membership + record links. Temp password returned ONCE — admin shares it
out-of-band (teacher/parent/student then login with email+password).
No self-signup privilege escalation: only owner/staff reach these endpoints.
"""
import secrets
import string
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_owner_or_staff
from app.database import first_row, get_supabase
from app.schemas.student import _clean_phone

router = APIRouter(prefix="/admin", tags=["admin"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _gen_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Cp-" + "".join(secrets.choice(alphabet) for _ in range(8))


def _valid_email(email: str) -> str:
    clean = (email or "").strip().lower()
    if "@" not in clean or "." not in clean.split("@")[-1] or len(clean) > 160:
        raise HTTPException(400, "Valid email dalo")
    return clean


def _create_auth_user(sb, email: str, password: str, full_name: str) -> str:
    """Returns auth user id. Raises 502 if admin API unavailable."""
    try:
        res = sb.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True, "user_metadata": {"full_name": full_name}}
        )
    except Exception as e:
        raise HTTPException(502, f"Auth user create failed: {e}") from e
    user_obj = getattr(res, "user", None) or (res.get("user") if isinstance(res, dict) else None)
    uid = (getattr(user_obj, "id", None) if user_obj else None) or (user_obj.get("id") if isinstance(user_obj, dict) else None)
    if not uid:
        raise HTTPException(502, "Auth user id nahi mila")
    return uid


class TeacherCreate(BaseModel):
    institute_id: str
    name: str = Field(min_length=2, max_length=120)
    email: str
    password: str | None = None
    batch_ids: list[str] = Field(default_factory=list)
    pic_url: str | None = None
    full_address: str | None = None


class StudentFullCreate(BaseModel):
    institute_id: str
    name: str = Field(min_length=1, max_length=120)
    batch: str | None = None
    monthly_fee: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    guardian_name: str | None = None
    guardian_phone: str | None = None
    student_phone: str | None = None


class LearnerAccountCreate(BaseModel):
    institute_id: str
    kind: str  # parent | student
    email: str
    password: str | None = None
    student_id: str
    guardian_id: str | None = None  # required when kind=parent
    pic_url: str | None = None
    full_address: str | None = None


@router.post("/teacher", status_code=201)
def admin_create_teacher(payload: TeacherCreate, user: dict = Depends(get_current_user)):
    """Teacher ka login banao + membership + batch assign. Password ek baar return."""
    require_owner_or_staff(payload.institute_id, user["id"])
    email = _valid_email(payload.email)
    password = (payload.password or "").strip() or _gen_password()
    if len(password) < 6:
        raise HTTPException(400, "Password kam se kam 6 characters")
    sb = _sb_or_503()
    uid = _create_auth_user(sb, email, password, payload.name.strip())
    try:
        sb.table("institute_members").insert(
            {"institute_id": payload.institute_id, "user_id": uid, "role": "teacher"}
        ).execute()
        profile_data: dict = {"id": uid, "full_name": payload.name.strip()}
        if (payload.pic_url or "").strip():
            profile_data["pic_url"] = payload.pic_url.strip()
        if (payload.full_address or "").strip():
            profile_data["full_address"] = payload.full_address.strip()
        sb.table("profiles").upsert(profile_data).execute()
        for bid in payload.batch_ids:
            b = first_row(sb.table("batches").select("id").eq("id", bid).eq("institute_id", payload.institute_id).execute())
            if b:
                sb.table("batch_teachers").upsert({"batch_id": bid, "user_id": uid}).execute()
    except Exception as e:
        try:
            sb.auth.admin.delete_user(uid)
        except Exception:
            pass
        raise HTTPException(400, f"Teacher setup failed (rolled back): {e}") from e
    return {
        "user_id": uid,
        "email": email,
        "temp_password": password,
        "role": "teacher",
        "note": "Ye password abhi teacher ko bata do — dobara nahi dikhega. Teacher isi email+password se login karega.",
    }


@router.post("/student-full", status_code=201)
def admin_create_student_full(payload: StudentFullCreate, user: dict = Depends(get_current_user)):
    """Student + guardian + link ek saath. Login alag se (learner-account)."""
    require_owner_or_staff(payload.institute_id, user["id"])
    import random

    sb = _sb_or_503()
    gphone = _clean_phone(payload.guardian_phone)
    sphone = _clean_phone(payload.student_phone)
    student = {
        "institute_id": payload.institute_id,
        "owner_id": user["id"],
        "name": payload.name.strip(),
        "batch": (payload.batch or "").strip() or None,
        "monthly_fee": str(payload.monthly_fee),
        "guardian_name": (payload.guardian_name or "").strip() or None,
        "guardian_phone": gphone,
        "student_phone": sphone,
        "status": "active",
        "admission_no": "ADM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6)),
        "pic_url": payload.pic_url,
    }
    created = first_row(sb.table("students").insert(student).select().execute())
    if not created:
        raise HTTPException(400, "Student create failed")
    guardian_id = None
    if (payload.guardian_name or "").strip() or gphone:
        grow = {
            "institute_id": payload.institute_id,
            "name": (payload.guardian_name or "Guardian").strip(),
            "phone": gphone,
        }
        try:
            g = first_row(sb.table("guardians").insert(grow).select().execute())
        except Exception:
            g = first_row(
                sb.table("guardians").select("id").eq("institute_id", payload.institute_id).eq("phone", gphone or "").limit(1).execute()
            ) if gphone else None
        if g:
            guardian_id = g["id"]
            sb.table("student_guardians").upsert({"student_id": created["id"], "guardian_id": guardian_id}).execute()
    return {"student": created, "guardian_id": guardian_id}


@router.post("/learner-account", status_code=201)
def admin_create_learner_account(payload: LearnerAccountCreate, user: dict = Depends(get_current_user)):
    """Parent/student ka login banao + record se link. Password ek baar return."""
    if payload.kind not in ("parent", "student"):
        raise HTTPException(400, "kind must be parent|student")
    require_owner_or_staff(payload.institute_id, user["id"])
    email = _valid_email(payload.email)
    password = (payload.password or "").strip() or _gen_password()
    if len(password) < 6:
        raise HTTPException(400, "Password kam se kam 6 characters")
    sb = _sb_or_503()
    st = first_row(sb.table("students").select("id").eq("id", payload.student_id).eq("institute_id", payload.institute_id).execute())
    if not st:
        raise HTTPException(404, "Student not found in this institute")
    if payload.kind == "parent":
        gid = payload.guardian_id
        if not gid:
            # Auto: student se juda pehla guardian lo (UI simple rahe)
            sg = sb.table("student_guardians").select("guardian_id").eq("student_id", payload.student_id).limit(1).execute().data or []
            gid = sg[0]["guardian_id"] if sg else None
        if not gid:
            raise HTTPException(400, "Is student se koi guardian juda nahi — pehle student-full/guardian banao")
        g = first_row(sb.table("guardians").select("id").eq("id", gid).eq("institute_id", payload.institute_id).execute())
        if not g:
            raise HTTPException(404, "Guardian not found")
    uid = _create_auth_user(sb, email, password, f"{payload.kind}:{st['id'][:8]}")
    try:
        sb.table("institute_members").insert(
            {"institute_id": payload.institute_id, "user_id": uid, "role": payload.kind}
        ).execute()
        if payload.kind == "student":
            sb.table("students").update({"user_id": uid}).eq("id", payload.student_id).execute()
        else:
            sb.table("guardians").update({"user_id": uid}).eq("id", gid).execute()
        profile_data: dict = {"id": uid, "full_name": email.split("@")[0]}
        if (payload.pic_url or "").strip():
            profile_data["pic_url"] = payload.pic_url.strip()
        if (payload.full_address or "").strip():
            profile_data["full_address"] = payload.full_address.strip()
        sb.table("profiles").upsert(profile_data).execute()
    except Exception as e:
        try:
            sb.auth.admin.delete_user(uid)
        except Exception:
            pass
        raise HTTPException(400, f"Account setup failed (rolled back): {e}") from e
    return {
        "user_id": uid,
        "email": email,
        "temp_password": password,
        "role": payload.kind,
        "note": "Ye password abhi share karo — dobara nahi dikhega. Login ke baad sahi dashboard auto-khulega.",
    }


@router.get("/members")
def admin_members(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    """Sab members role-wise. Owner/staff only."""
    require_owner_or_staff(institute_id, user["id"])
    sb = _sb_or_503()
    return (
        sb.table("institute_members")
        .select("user_id,role,created_at")
        .eq("institute_id", institute_id)
        .order("created_at")
        .limit(500)
        .execute()
        .data
        or []
    )
