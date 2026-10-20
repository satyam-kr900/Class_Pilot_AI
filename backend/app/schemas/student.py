from decimal import Decimal
from pydantic import BaseModel, Field


def _clean_phone(v: str | None) -> str | None:
    """Digits only, last 10 (India). Returns None if empty."""
    if not v:
        return None
    d = "".join(c for c in v if c.isdigit())[-10:]
    return d or None


class StudentCreate(BaseModel):
    institute_id: str
    name: str = Field(min_length=1, max_length=120)
    batch: str | None = Field(default=None, max_length=80)
    monthly_fee: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    guardian_name: str | None = None
    guardian_phone: str | None = None
    student_phone: str | None = None  # personal mobile (self login finder)
    class_name: str | None = None
    pic_url: str | None = None


class StudentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    batch: str | None = None
    monthly_fee: Decimal | None = Field(default=None, ge=Decimal("0"))
    status: str | None = None  # active | archived (validated in route)
    guardian_name: str | None = None
    guardian_phone: str | None = None
    student_phone: str | None = None
    class_name: str | None = None
    pic_url: str | None = None


class StudentOut(BaseModel):
    id: str
    institute_id: str | None = None
    owner_id: str | None = None
    admission_no: str | None = None
    status: str | None = None
    name: str
    batch: str | None = None
    monthly_fee: Decimal = Decimal("0")
    guardian_name: str | None = None
    guardian_phone: str | None = None
    student_phone: str | None = None
    pic_url: str | None = None


class FeePaymentCreate(BaseModel):
    institute_id: str
    student_id: str
    amount: Decimal = Field(gt=Decimal("0"))
    payment_method: str = "cash"
    note: str | None = None
    idempotency_key: str | None = None  # UUID from client; generated server-side if missing


class AttendanceUpsert(BaseModel):
    institute_id: str
    student_id: str
    attendance_date: str | None = None  # YYYY-MM-DD, default today
    status: str = "present"  # present | absent | late
