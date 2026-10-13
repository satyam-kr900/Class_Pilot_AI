"""Phase 4 AI — assistant with guardrails.

- LLM calls ONLY via backend, keys never leave server.
- explain/quiz need AI_API_KEY; insights/admin work locally from real data.
- Rate limit: 30 AI calls / user / institute / day. All calls logged.
- Quiz output schema-validated; teacher must review before publishing.
- No chain-of-thought exposed; minimal PII sent to provider.
"""
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_institute_membership, teacher_batch_ids
from app.core.config import settings
from app.database import get_supabase

router = APIRouter(prefix="/ai", tags=["ai"])
DAILY_LIMIT = 30
QUIZ_TYPES = {"mcq", "short", "mixed"}


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _check_quota(sb, institute_id: str, user_id: str):
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    n = (
        sb.table("ai_usage_logs")
        .select("id", count="exact")
        .eq("institute_id", institute_id)
        .eq("user_id", user_id)
        .gte("created_at", since)
        .execute()
    )
    count = getattr(n, "count", None) or len(n.data or [])
    if count >= DAILY_LIMIT:
        raise HTTPException(429, f"Daily AI limit ({DAILY_LIMIT}) reached — kal try karo")


def _log(sb, institute_id: str, user_id: str, feature: str, status: str = "ok"):
    try:
        sb.table("ai_usage_logs").insert(
            {"institute_id": institute_id, "user_id": user_id, "feature": feature, "status": status}
        ).execute()
    except Exception:
        pass


def _llm_chat(system: str, user_msg: str, max_tokens: int = 800) -> str:
    """OpenAI-compatible chat call via stdlib (no new deps). Raises 503 if unconfigured."""
    if not settings.AI_API_KEY:
        raise HTTPException(503, "AI not configured — backend me AI_API_KEY dalo (.env). Insights/admin neeche bina key kaam karte hain.")
    body = json.dumps(
        {"model": settings.AI_MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_msg}], "max_tokens": max_tokens, "temperature": 0.4}
    ).encode()
    req = urllib.request.Request(
        f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings.AI_API_KEY}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            data = json.loads(res.read().decode())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"AI provider failed: {e}") from e
    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        raise HTTPException(502, f"AI bad response: {e}") from e


class ExplainIn(BaseModel):
    institute_id: str
    subject: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=1, max_length=200)
    level: str = Field(default="class", pattern="^(easy|class|advanced)$")


class QuizIn(BaseModel):
    institute_id: str
    subject: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=1, max_length=200)
    level: str = Field(default="class")
    count: int = Field(default=5, ge=1, le=10)
    qtype: str = Field(default="mcq")


class AdminIn(BaseModel):
    institute_id: str
    question: str = Field(min_length=3, max_length=500)


@router.post("/explain")
def explain(payload: ExplainIn, user: dict = Depends(get_current_user)):
    require_institute_membership(payload.institute_id, user["id"])
    sb = _sb_or_503()
    _check_quota(sb, payload.institute_id, user["id"])
    system = "You are ClassPilot AI tutor. Explain clearly with examples. End with 2 revision questions. Never invent institute data."
    out = _llm_chat(system, f"Subject: {payload.subject}\nTopic: {payload.topic}\nLevel: {payload.level}")
    _log(sb, payload.institute_id, user["id"], "explain")
    return {"explanation": out, "source": "ai", "note": "AI explanation — official notes se verify karo"}


@router.post("/quiz")
def quiz(payload: QuizIn, user: dict = Depends(get_current_user)):
    from app.api_deps import require_staff

    require_staff(payload.institute_id, user["id"])
    if payload.qtype not in QUIZ_TYPES:
        raise HTTPException(400, f"qtype one of {sorted(QUIZ_TYPES)}")
    sb = _sb_or_503()
    _check_quota(sb, payload.institute_id, user["id"])
    system = (
        "Generate a quiz as STRICT JSON array. Each item: "
        '{"q": str, "options": [4 strings] for mcq else [], "answer": str, "why": str, "level": "easy|class|advanced"}. '
        "No markdown, JSON only."
    )
    raw = _llm_chat(system, f"Subject: {payload.subject}\nTopic: {payload.topic}\nLevel: {payload.level}\nCount: {payload.count}\nType: {payload.qtype}")
    try:
        items = json.loads(raw[raw.index("["): raw.rindex("]") + 1])
        assert isinstance(items, list) and 1 <= len(items) <= 10
        for it in items:
            assert isinstance(it.get("q"), str) and isinstance(it.get("answer"), str)
            if payload.qtype == "mcq":
                assert isinstance(it.get("options"), list) and len(it["options"]) == 4
    except Exception as e:
        _log(sb, payload.institute_id, user["id"], "quiz", status="schema_fail")
        raise HTTPException(502, f"AI quiz schema invalid, retry karo: {e}") from e
    _log(sb, payload.institute_id, user["id"], "quiz")
    return {"questions": items, "status": "draft — teacher review ke baad publish karo"}


@router.get("/insights")
def insights(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    """Evidence-based, no LLM needed. Uses real attendance/marks/assignments."""
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    students = sb.table("students").select("id,name").eq("institute_id", institute_id).eq("status", "active").limit(500).execute().data or []
    att = sb.table("attendance").select("student_id,status").eq("institute_id", institute_id).limit(2000).execute().data or []
    from collections import defaultdict

    by: dict[str, list] = defaultdict(list)
    for a in att:
        by[a["student_id"]].append(a["status"])
    low_att = [
        {"student_id": sid, "name": next((s["name"] for s in students if s["id"] == sid), sid),
         "pct": round(sum(1 for x in v if x == "present") / len(v) * 100)}
        for sid, v in by.items() if len(v) >= 3 and sum(1 for x in v if x == "present") / len(v) < 0.6
    ][:10]
    assigns = sb.table("assignments").select("id,title").eq("institute_id", institute_id).limit(100).execute().data or []
    subs = sb.table("assignment_submissions").select("assignment_id").limit(2000).execute().data or []
    done = {s["assignment_id"] for s in subs}
    missing_hw = [a for a in assigns if a["id"] not in done][:10]
    overdue_exams = sb.table("exams").select("id,name").eq("institute_id", institute_id).eq("status", "draft").limit(10).execute().data or []
    pays = sb.table("fee_payments").select("student_id").eq("institute_id", institute_id).limit(2000).execute().data or []
    paid = {p["student_id"] for p in pays}
    dues = [s for s in students if s["id"] not in paid][:10]
    _log(sb, institute_id, user["id"], "insights")
    return {
        "low_attendance": low_att,
        "missing_homework": missing_hw,
        "draft_exams_needing_marks": overdue_exams,
        "fee_dues": dues,
        "evidence": "Real DB counts — koi invented grade nahi",
    }


@router.post("/admin")
def admin(payload: AdminIn, user: dict = Depends(get_current_user)):
    """Permission-checked canned tools. No raw AI SQL."""
    from app.api_deps import require_staff

    require_staff(payload.institute_id, user["id"])
    sb = _sb_or_503()
    _check_quota(sb, payload.institute_id, user["id"])
    q = payload.question.lower()
    iid = payload.institute_id
    out: dict = {"answer": "", "evidence": []}
    if any(w in q for w in ("due", "pending", "outstanding", "fee")):
        studs = sb.table("students").select("id,name,monthly_fee").eq("institute_id", iid).eq("status", "active").limit(200).execute().data or []
        pays = sb.table("fee_payments").select("student_id").eq("institute_id", iid).limit(2000).execute().data or []
        paid = {p["student_id"] for p in pays}
        dues = [s for s in studs if s["id"] not in paid]
        out = {"answer": f"{len(dues)} students ke dues pending hain.", "evidence": dues[:10]}
    elif any(w in q for w in ("attendance", "absent", "present")):
        rows = sb.table("attendance").select("student_id,status").eq("institute_id", iid).limit(2000).execute().data or []
        total = len(rows)
        present = sum(1 for r in rows if r.get("status") == "present")
        out = {"answer": f"Recorded attendance: {present}/{total} present.", "evidence": []}
    elif any(w in q for w in ("homework", "assignment", "overdue")):
        rows = sb.table("assignments").select("id,title,due_date").eq("institute_id", iid).limit(50).execute().data or []
        out = {"answer": f"{len(rows)} assignments total.", "evidence": rows[:10]}
    elif any(w in q for w in ("exam", "marks")):
        rows = sb.table("exams").select("id,name,status").eq("institute_id", iid).limit(50).execute().data or []
        drafts = [r for r in rows if r.get("status") == "draft"]
        out = {"answer": f"{len(drafts)} draft exams need marks/publish.", "evidence": drafts}
    else:
        out = {"answer": "Fees/dues, attendance, homework, ya exams ke baare me pucho (e.g. 'which fees are outstanding?').", "evidence": []}
    _log(sb, iid, user["id"], "admin")
    return out
