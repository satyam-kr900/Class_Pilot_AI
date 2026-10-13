"""WhatsApp provider adapter (Meta Cloud API compatible).

- Credentials stay server-side. Never claim sent when only queued.
- Unconfigured -> raises 503 with setup instructions (no fake delivery).
- Consent enforced by caller via notification_preferences.
"""
import json
import urllib.request
from fastapi import HTTPException

from app.core.config import settings


def is_configured() -> bool:
    return bool(settings.WHATSAPP_PROVIDER and settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_ID)


def send_template(to_phone: str, template: str, lang: str = "en", params: list[str] | None = None) -> dict:
    """Send approved template message. Returns provider response. Raises on failure."""
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="WhatsApp not configured — backend me WHATSAPP_PROVIDER/TOKEN/PHONE_ID dalo aur template approve karao. Message queued (in-app) only.",
        )
    url = f"https://graph.facebook.com/v21.0/{settings.WHATSAPP_PHONE_ID}/messages"
    components = []
    if params:
        components = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}]
    payload = json.dumps(
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {"name": template, "language": {"code": lang}, "components": components},
        }
    ).encode()
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp provider failed: {e}") from e
