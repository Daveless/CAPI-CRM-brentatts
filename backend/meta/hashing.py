"""
SHA256 hashing utilities for Meta Conversions API.
Shared by both Purchase events and Qualified Leads events.
All PII is hashed before leaving the server.
"""
from __future__ import annotations
import hashlib


def _hash(value: str) -> str:
    if not value:
        return ""
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def hash_user_data(data: dict) -> dict:
    field_map = {
        "email": "em", "phone": "ph", "first_name": "fn", "last_name": "ln",
        "gender": "ge", "date_of_birth": "db", "city": "ct", "state": "st",
        "zip": "zp", "country": "country",
    }
    result = {}
    for src, dest in field_map.items():
        if data.get(src):
            result[dest] = _hash(data[src])

    for f in ["external_id", "client_ip_address", "client_user_agent", "fbc", "fbp"]:
        if data.get(f):
            result[f] = data[f]

    return result
