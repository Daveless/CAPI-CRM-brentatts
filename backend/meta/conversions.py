"""
Meta Conversions API (CAPI) client — adaptado para tattoo-crm.

Envía eventos Purchase a Meta Pixel con datos de clientes completados.
Todo PII se hashea con SHA256 antes de salir del servidor.
"""

from __future__ import annotations
import httpx
import logging
from datetime import datetime

from .hashing import hash_user_data

logger = logging.getLogger("conversions")

META_API = "https://graph.facebook.com/v25.0"


async def send_purchase_event(
    pixel_id: str,
    access_token: str,
    user_data: dict,
    value: float,
    event_id: str | None = None,
) -> dict:
    """
    Send a single Purchase event to the Meta Conversions API.

    Args:
        pixel_id: Meta Pixel ID
        access_token: Meta API access token
        user_data: dict with email, phone, first_name, last_name, city, state, zip, country
        value: Purchase value in dollars (ej. 150.00)
        event_id: Optional deduplication ID
    """
    url = f"{META_API}/{pixel_id}/events"

    hashed_user_data = hash_user_data(user_data)

    payload = {
        "data": [
            {
                "event_name": "Purchase",
                "event_time": int(datetime.now().timestamp()),
                "action_source": "physical_store",
                "user_data": hashed_user_data,
                "custom_data": {
                    "value": value,
                    "currency": "USD",
                },
            }
        ],
        "access_token": access_token,
    }

    if event_id:
        payload["data"][0]["event_id"] = event_id

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload)
        data = response.json()

    if "error" in data:
        msg = data["error"].get("message", "Unknown error")
        logger.warning(f"CAPI error: {msg}")
        return {"success": False, "error": msg}

    return {
        "success": True,
        "events_received": data.get("events_received", 0),
        "fbtrace_id": data.get("fbtrace_id", ""),
    }
