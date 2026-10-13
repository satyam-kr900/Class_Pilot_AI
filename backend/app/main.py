from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core.config import settings
from app.routes import auth, students, classes, fees, attendance, insights, institutes, batches, sessions, assignments, exams, materials, enquiries, portals, ai, subscriptions, notifications, billing, admin

log = logging.getLogger("classpilot")

app = FastAPI(title="ClassPilot AI API", version="1.0.0")

if not settings.is_dev and set(settings.allowed_origins_list) <= {"http://localhost:3000", "http://127.0.0.1:3000"}:
    log.warning("APP_ENV=prod but ALLOWED_ORIGINS still localhost — browser calls will 400. Set ALLOWED_ORIGINS to the frontend domain.")

# Phase 1 CORS: dev me localhost allow, prod me ALLOWED_ORIGINS env se.
# Old wildcard-regex + credentials combo browsers block karte hain + insecure hai.
if settings.is_dev:
    # Dev: localhost/127/LAN (phone testing) kisi bhi port se — regex origin echo
    # karta hai isliye credentials ke saath safe hai. max_age preflight storms rokta hai.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"(https?|exp)://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=600,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

# Legacy paths (existing frontend/mobile use /students, /auth/*) — keep working.
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(classes.router)
app.include_router(fees.router)
app.include_router(attendance.router)
app.include_router(insights.router)
app.include_router(institutes.router)
app.include_router(batches.router)
app.include_router(sessions.router)
app.include_router(assignments.router)
app.include_router(exams.router)
app.include_router(materials.router)
app.include_router(enquiries.router)
app.include_router(portals.router)
app.include_router(ai.router)
app.include_router(subscriptions.router)
app.include_router(notifications.router)
app.include_router(billing.router)
app.include_router(admin.router)

# Versioned API — new code must use /api/v1/*.
app.include_router(auth.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(classes.router, prefix="/api/v1")
app.include_router(fees.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(institutes.router, prefix="/api/v1")
app.include_router(batches.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(assignments.router, prefix="/api/v1")
app.include_router(exams.router, prefix="/api/v1")
app.include_router(materials.router, prefix="/api/v1")
app.include_router(enquiries.router, prefix="/api/v1")
app.include_router(portals.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(subscriptions.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"name": "ClassPilot AI API", "docs": "/docs", "version": "1.0.0", "api": "/api/v1"}


@app.get("/api/v1/health")
def api_health():
    return {"status": "ok", "api": "v1"}
