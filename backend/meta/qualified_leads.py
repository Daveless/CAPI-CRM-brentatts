"""
Meta Qualified Leads CRM Integration.

Sends lead stage change events to Meta's Conversions API endpoint:
POST https://graph.facebook.com/v25.0/{DATASET_ID}/events

All PII is SHA256-hashed in array format before leaving the server.
client_user_agent is passed through unhashed.
"""

from __future__ import annotations
import httpx
import logging
from datetime import datetime

from .hashing import hash_user_data
from .conversions import META_API

logger = logging.getLogger("qualified_leads")

LEAD_EVENT_SOURCE = "TattooCRM"


async def send_lead_event(
    dataset_id: str,
    access_token: str,
    user_data: dict,
    event_name: str,
    event_time: int | None = None,
    lead_id: str | None = None,
    event_id: str | None = None,
    event_source_url: str = "",
    client_user_agent: str = "",
    test_event_code: str = "",
) -> dict:
    url = f"{META_API}/{dataset_id}/events"

    hashed = hash_user_data(user_data)
    if lead_id:
        hashed["lead_id"] = lead_id

    if client_user_agent:
        hashed["client_user_agent"] = client_user_agent

    payload: dict = {
        "data": [
            {
                "event_name": event_name,
                "event_time": event_time or int(datetime.now().timestamp()),
                "action_source": "website",
                "user_data": hashed,
                "custom_data": {
                    "event_source": "crm",
                    "lead_event_source": LEAD_EVENT_SOURCE,
                },
            }
        ],
        "access_token": access_token,
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
        logger.warning("Qualified Leads error: %s", msg)
        return {"success": False, "error": msg}

    return {
        "success": True,
        "events_received": data.get("events_received", 0),
        "fbtrace_id": data.get("fbtrace_id", ""),
    }
