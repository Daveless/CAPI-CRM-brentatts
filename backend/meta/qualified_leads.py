"""
Meta Qualified Leads CRM Integration.
Sends lead stage change events to Meta's Conversions API via a Dataset endpoint.

Endpoint: POST https://graph.facebook.com/v25.0/{dataset_id}/events?access_token=TOKEN
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
    test_event_code: str | None = None,
) -> dict:
    """
    Send a Qualified Lead stage change event to Meta.

    Args:
        dataset_id: Meta Dataset ID (e.g. "1047090114932525")
        access_token: Meta API access token
        user_data: dict with email, phone, first_name, last_name, city, state, zip, country
        event_name: CRM stage name (e.g. "Lead", "Converted")
        event_time: UNIX timestamp (defaults to now)
        lead_id: Optional Meta-generated lead ID (15-17 digits)
        test_event_code: Optional test event code for validation without affecting production
    """
    url = f"{META_API}/{dataset_id}/events"

    hashed_user_data = hash_user_data(user_data)
    if lead_id:
        hashed_user_data["lead_id"] = lead_id

    payload = {
        "data": [
            {
                "event_name": event_name,
                "event_time": event_time or int(datetime.now().timestamp()),
                "action_source": "system_generated",
                "user_data": hashed_user_data,
                "custom_data": {
                    "event_source": "crm",
                    "lead_event_source": LEAD_EVENT_SOURCE,
                },
            }
        ],
        "access_token": access_token,
    }

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
        logger.warning(f"Qualified Leads error: {msg}")
        return {"success": False, "error": msg}

    return {
        "success": True,
        "events_received": data.get("events_received", 0),
        "fbtrace_id": data.get("fbtrace_id", ""),
    }
