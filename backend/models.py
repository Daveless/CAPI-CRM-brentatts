from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Literal, Optional, Any

# ── Client CRUD ──────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    first_name: str
    last_name: str
    email: str = ""
    phone: str = ""
    city: str = "Quito"
    state: str = "Pichincha"
    zip: str = ""
    country: str = "EC"
    tattoo_price: int = Field(ge=0, description="Precio del tatuaje en centavos")
    material_cost: int = Field(default=0, ge=0, description="Gasto en materiales en centavos")
    appointment_date: Optional[date] = None
    status: Literal["adelanto_pagado", "completado"] = "adelanto_pagado"
    tattoo_description: str = ""


class ClientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    tattoo_price: Optional[int] = Field(default=None, ge=0)
    material_cost: Optional[int] = Field(default=None, ge=0)
    appointment_date: Optional[date] = None
    status: Optional[Literal["adelanto_pagado", "completado"]] = None
    capi_status: Optional[Literal["enviado", "no_enviado"]] = None
    tattoo_description: Optional[str] = None


class ClientResponse(BaseModel):
    id: str
    user_id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    city: str
    state: str
    zip: str
    country: str
    tattoo_price: int
    deposit: int
    material_cost: int
    appointment_date: Optional[date] = None
    status: str
    capi_status: Optional[str] = None
    lead_synced_at: Optional[datetime] = None
    purchase_synced_at: Optional[datetime] = None
    tattoo_description: str
    created_at: datetime
    updated_at: datetime
    meta_event: Optional[dict[str, Any]] = None


# ── Dashboard ────────────────────────────────────────────────────────

class MonthlyBreakdown(BaseModel):
    month: str
    total_income: int
    total_cost: int
    profit: int
    client_count: int


class DashboardResponse(BaseModel):
    total_clients: int
    adelanto_count: int
    completado_count: int
    total_income: int
    total_cost: int
    profit: int
    pending_capi: int
    monthly: list[MonthlyBreakdown]


# ── CAPI Sync ────────────────────────────────────────────────────────

class CapiSyncRequest(BaseModel):
    access_token: str


class CapiSyncResult(BaseModel):
    client_id: str
    client_name: str
    success: bool
    event_type: Literal["lead", "purchase"] = "purchase"
    error: str = ""


class CapiSyncResponse(BaseModel):
    total: int
    sent: int
    failed: int
    results: list[CapiSyncResult]
