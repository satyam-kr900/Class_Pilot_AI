"""Profile API — role-specific profile data for institute, student, teacher, admin."""
from fastapi import APIRouter, Depends
from app.api_deps import get_current_user, require_institute_membership
from app.database import first_row, get_supabase

router = APIRouter(tags=["profiles"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/me")
def get_my_profile(user: dict = Depends(get_current_user)):
    """Return the caller's profile + institute membership role."""
    sb = get_supabase()
    # Get institute membership role
    mem = (
        sb.table("institute_members")
        .select("role, institute_id")
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    role = (mem.data or [{}])[0].get("role") if mem.data else None
    institute_id = (mem.data or [{}])[0].get("institute_id") if mem.data else None

    # Get profile data
    profile = first_row(
        sb.table("profiles").select("pic_url, full_name, full_address").eq("id", user["id"]).execute()
    )

    # Institute picture (for owner)
    institute = first_row(
        sb.table("institutes").select("pic_url, name").eq("owner_id", user["id"]).execute()
    )

    # Role-specific extra data
    extra = {}
    if role == "teacher":
        # Teacher data from teachers table
        teacher = first_row(
            sb.table("teachers").select("qualifications, subjects, classes, experience, residential_address, pic_url").eq("institute_id", institute_id).eq("user_id", user["id"]).execute()
        )
        extra["pic_url"] = teacher.get("pic_url") if teacher else (profile.get("pic_url") if profile else None)
        extra["full_address"] = teacher.get("residential_address") if teacher else (profile.get("full_address") if profile else None)
        extra["qualifications"] = teacher.get("qualifications") if teacher else None
        extra["subjects"] = teacher.get("subjects") if teacher else None
        extra["classes"] = teacher.get("classes") if teacher else None
        extra["experience"] = teacher.get("experience") if teacher else None
    elif role in ("student", "parent"):
        # Student pic from students table
        student = {}
        if institute_id:
            student = first_row(
                sb.table("students").select("pic_url, admission_no, roll_number, course, guardian_name, guardian_phone, class_name, full_address").eq("institute_id", institute_id).eq("user_id", user["id"]).execute()
            )
        extra["pic_url"] = student.get("pic_url") if student else None
        extra["full_address"] = student.get("full_address") if student else (profile.get("full_address") if profile else None)
        extra["admission_no"] = student.get("admission_no") if student else None
        extra["roll_number"] = student.get("roll_number") if student else None
        extra["course"] = student.get("course") if student else None
        extra["guardian_name"] = student.get("guardian_name") if student else None
        extra["guardian_phone"] = student.get("guardian_phone") if student else None
        extra["class_name"] = student.get("class_name") if student else None
    elif role == "owner":
        extra["pic_url"] = profile.get("pic_url") if profile else None
        extra["full_address"] = profile.get("full_address") if profile else None
        if institute:
            extra["institute_pic_url"] = institute.get("pic_url")

    result: dict = {"role": role}
    if profile:
        result["pic_url"] = profile.get("pic_url")
        result["full_name"] = profile.get("full_name")
        result["full_address"] = profile.get("full_address")
    result.update(extra)
    return result