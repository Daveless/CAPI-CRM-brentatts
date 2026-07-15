"""
Meta Conversions API (CAPI) client — Purchase events.

POST https://graph.facebook.com/v25.0/{PIXEL_ID}/events

All PII is SHA256-hashed in array format before leaving the server.
client_user_agent is passed through unhashed.
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
    event_source_url: str = "",
    client_user_agent: str = "",
    test_event_code: str = "",
) -> dict:
    url = f"{META_API}/{pixel_id}/events"

    hashed = hash_user_data(user_data)

    if client_user_agent:
        hashed["client_user_agent"] = client_user_agent

    payload: dict = {
        "data": [
            {
                "event_name": "Purchase",
                "event_time": int(datetime.now().timestamp()),
                "action_source": "website",
                "user_data": hashed,
                "custom_data": {
                    "value": value,
                    "currency": "USD",
                },
            }
        ],
    }

    if event_id:
        payload["data"][0]["event_id"] = event_id

    if event_source_url:
        payload["data"][0]["event_source_url"] = event_source_url

    if test_event_code:
        payload["test_event_code"] = test_event_code

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            params={"access_token": access_token},
            json=payload,
        )
        data = response.json()

    if "error" in data:
        msg = data["error"].get("message", "Unknown error")
        logger.warning("CAPI Purchase error: %s", msg)
        return {"success": False, "error": msg}

    return {
        "success": True,
        "events_received": data.get("events_received", 0),
        "fbtrace_id": data.get("fbtrace_id", ""),
    }
