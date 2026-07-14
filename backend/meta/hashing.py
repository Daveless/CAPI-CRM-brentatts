"""
SHA256 hashing utilities for Meta Conversions API.
Shared by both Purchase events and Qualified Leads events.
All PII is hashed before leaving the server.

Returns hashed values in array format as preferred by Meta:
  {"em": ["abc123..."]}
Fields NOT hashed (passed through):
  external_id, client_ip_address, client_user_agent, fbc, fbp
"""

from __future__ import annotations
import hashlib


def _hash(value: str) -> str:
    if not value:
        return ""
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


_HASHED_FIELDS = {
    "email": "em",
    "phone": "ph",
    "first_name": "fn",
    "last_name": "ln",
    "gender": "ge",
    "date_of_birth": "db",
    "city": "ct",
    "state": "st",
    "zip": "zp",
    "country": "country",
}

_PASSTHROUGH_FIELDS = (
    "external_id", "client_ip_address", "client_user_agent", "fbc", "fbp"
)


def hash_user_data(data: dict) -> dict:
    result: dict = {}

    for src, dest in _HASHED_FIELDS.items():
        val = data.get(src)
        if val:
            result[dest] = [_hash(val)]

    for field in _PASSTHROUGH_FIELDS:
        val = data.get(field)
        if val:
            result[field] = val

    return result
