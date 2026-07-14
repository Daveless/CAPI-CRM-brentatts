import logging
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from config import settings
from auth import get_current_user
from supabase_client import get_supabase
from models import (
    ClientCreate, ClientUpdate, ClientResponse,
    DashboardResponse, MonthlyBreakdown,
    CapiSyncRequest, CapiSyncResponse, CapiSyncResult,
)
from meta.conversions import send_purchase_event
from meta.qualified_leads import send_lead_event

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tattoo-crm")

app = FastAPI(title="Tattoo CRM", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────

def _row_to_client(row: dict) -> ClientResponse:
    return ClientResponse(
        id=row["id"],
        user_id=row["user_id"],
        first_name=row.get("first_name", ""),
        last_name=row.get("last_name", ""),
        email=row.get("email", ""),
        phone=row.get("phone", ""),
        city=row.get("city", ""),
        state=row.get("state", ""),
        zip=row.get("zip", ""),
        country=row.get("country", "US"),
        tattoo_price=row.get("tattoo_price", 0),
        deposit=row.get("deposit", 1000),
        material_cost=row.get("material_cost", 0),
        appointment_date=row.get("appointment_date"),
        status=row.get("status", "adelanto_pagado"),
        capi_status=row.get("capi_status"),
        tattoo_description=row.get("tattoo_description", ""),
        meta_lead_id=row.get("meta_lead_id"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _extract_user_data(client: dict) -> dict:
    return {
        "email": client.get("email", ""),
        "phone": client.get("phone", ""),
        "first_name": client.get("first_name", ""),
        "last_name": client.get("last_name", ""),
        "city": client.get("city", ""),
        "state": client.get("state", ""),
        "zip": client.get("zip", ""),
        "country": client.get("country", "US"),
    }


# ── Auth check ───────────────────────────────────────────────────────

@app.get("/api/me")
async def me(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    user = supabase.auth.admin.get_user_by_id(user_id)
    return {
        "user_id": user_id,
        "email": user.user.email if user.user else "",
    }


# ── Clients CRUD ─────────────────────────────────────────────────────

@app.get("/api/clients", response_model=list[ClientResponse])
async def list_clients(
    status: str = "",
    user_id: str = Depends(get_current_user),
):
    supabase = get_supabase()
    query = supabase.table("clients").select("*").eq("user_id", user_id)
    if status:
        query = query.eq("status", status)
    query = query.order("created_at", desc=True)
    result = query.execute()
    return [_row_to_client(r) for r in result.data]


@app.post("/api/clients", response_model=ClientResponse)
async def create_client(
    body: ClientCreate,
    user_id: str = Depends(get_current_user),
    x_meta_token: Optional[str] = Header(None, alias="X-Meta-Token"),
):
    supabase = get_supabase()
    data = body.model_dump(mode="json")
    data["user_id"] = user_id
    data["deposit"] = 1000
    if body.status == "completado":
        data["capi_status"] = "no_enviado"
    result = supabase.table("clients").insert(data).execute()
    if not result.data:
        raise HTTPException(500, "Error al crear cliente")

    client_row = result.data[0]
    response = _row_to_client(client_row)

    if x_meta_token and settings.qualified_leads_dataset_id:
        user_data = _extract_user_data(client_row)
        lead_result = await send_lead_event(
            dataset_id=settings.qualified_leads_dataset_id,
            access_token=x_meta_token,
            user_data=user_data,
            event_name="Lead",
            lead_id=client_row.get("meta_lead_id"),
        )
        response.meta_event = {"type": "qualified_lead", **lead_result}
        if not lead_result["success"]:
            logger.warning(f"Qualified Lead event failed for client {client_row['id']}: {lead_result.get('error')}")

    return response


@app.put("/api/clients/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    user_id: str = Depends(get_current_user),
    x_meta_token: Optional[str] = Header(None, alias="X-Meta-Token"),
):
    supabase = get_supabase()

    existing = supabase.table("clients").select("*").eq("id", client_id).eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(404, "Cliente no encontrado")

    current = existing.data[0]
    data = body.model_dump(exclude_none=True, mode="json")

    transitioning_to_completado = (
        "status" in data
        and data["status"] == "completado"
        and current.get("status") != "completado"
    )

    if transitioning_to_completado:
        data["capi_status"] = "no_enviado"

    result = supabase.table("clients").update(data).eq("id", client_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(500, "Error al actualizar cliente")

    client_row = result.data[0]
    response = _row_to_client(client_row)

    if transitioning_to_completado and x_meta_token and settings.conversions_pixel_id:
        user_data = _extract_user_data(client_row)
        value_dollars = client_row.get("tattoo_price", 0) / 100.0
        purchase_result = await send_purchase_event(
            pixel_id=settings.conversions_pixel_id,
            access_token=x_meta_token,
            user_data=user_data,
            value=value_dollars,
            event_id=f"tattoo_{client_id}",
        )
        response.meta_event = {"type": "purchase", **purchase_result}
        if purchase_result["success"]:
            supabase.table("clients").update({"capi_status": "enviado"}).eq("id", client_id).execute()
            response.capi_status = "enviado"
        else:
            logger.warning(f"Purchase event failed for client {client_id}: {purchase_result.get('error')}")

    return response


@app.delete("/api/clients/{client_id}")
async def delete_client(
    client_id: str,
    user_id: str = Depends(get_current_user),
):
    supabase = get_supabase()
    existing = supabase.table("clients").select("*").eq("id", client_id).eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(404, "Cliente no encontrado")

    supabase.table("clients").delete().eq("id", client_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ── Dashboard ────────────────────────────────────────────────────────

@app.get("/api/dashboard", response_model=DashboardResponse)
async def dashboard(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    rows = supabase.table("clients").select("*").eq("user_id", user_id).execute()

    clients = rows.data
    total = len(clients)
    adelanto = sum(1 for c in clients if c.get("status") == "adelanto_pagado")
    completado = sum(1 for c in clients if c.get("status") == "completado")
    total_income = sum(c.get("tattoo_price", 0) for c in clients if c.get("status") == "completado")
    total_cost = sum(c.get("material_cost", 0) for c in clients)
    profit = total_income - total_cost
    pending = sum(1 for c in clients if c.get("status") == "completado" and c.get("capi_status") == "no_enviado")

    monthly: dict[str, dict] = {}
    for c in clients:
        if c.get("created_at"):
            m = c["created_at"][:7]
            if m not in monthly:
                monthly[m] = {"total_income": 0, "total_cost": 0, "client_count": 0}
            monthly[m]["client_count"] += 1
            if c.get("status") == "completado":
                monthly[m]["total_income"] += c.get("tattoo_price", 0)
            monthly[m]["total_cost"] += c.get("material_cost", 0)

    monthly_list = [
        MonthlyBreakdown(
            month=k,
            total_income=v["total_income"],
            total_cost=v["total_cost"],
            profit=v["total_income"] - v["total_cost"],
            client_count=v["client_count"],
        )
        for k, v in sorted(monthly.items(), reverse=True)
    ]

    return DashboardResponse(
        total_clients=total,
        adelanto_count=adelanto,
        completado_count=completado,
        total_income=total_income,
        total_cost=total_cost,
        profit=profit,
        pending_capi=pending,
        monthly=monthly_list,
    )


# ── Qualified Leads Test ───────────────────────────────────────────────

@app.post("/api/qualified-leads/test")
async def qualified_leads_test(
    user_id: str = Depends(get_current_user),
    x_meta_token: Optional[str] = Header(None, alias="X-Meta-Token"),
):
    if not x_meta_token:
        raise HTTPException(400, "X-Meta-Token header requerido")
    if not settings.qualified_leads_dataset_id:
        raise HTTPException(400, "QUALIFIED_LEADS_DATASET_ID no configurado en .env")

    result = await send_lead_event(
        dataset_id=settings.qualified_leads_dataset_id,
        access_token=x_meta_token,
        user_data={
            "email": "test@example.com",
            "phone": "+15551234567",
            "first_name": "Test",
            "last_name": "User",
        },
        event_name="Lead",
        test_event_code="TEST28799",
    )
    return result


# ── CAPI Sync ────────────────────────────────────────────────────────

@app.post("/api/capi/sync", response_model=CapiSyncResponse)
async def capi_sync(
    body: CapiSyncRequest,
    user_id: str = Depends(get_current_user),
):
    if not settings.conversions_pixel_id:
        raise HTTPException(400, "CONVERSIONS_PIXEL_ID no configurado en .env")

    supabase = get_supabase()

    pending = supabase.table("clients").select("*")\
        .eq("user_id", user_id)\
        .eq("status", "completado")\
        .eq("capi_status", "no_enviado")\
        .execute()

    if not pending.data:
        return CapiSyncResponse(total=0, sent=0, failed=0, results=[])

    results: list[CapiSyncResult] = []
    sent = 0
    failed = 0

    for client in pending.data:
        user_data = {
            "email": client.get("email", ""),
            "phone": client.get("phone", ""),
            "first_name": client.get("first_name", ""),
            "last_name": client.get("last_name", ""),
            "city": client.get("city", ""),
            "state": client.get("state", ""),
            "zip": client.get("zip", ""),
            "country": client.get("country", "US"),
        }
        value_dollars = client.get("tattoo_price", 0) / 100.0

        capi_result = await send_purchase_event(
            pixel_id=settings.conversions_pixel_id,
            access_token=body.access_token,
            user_data=user_data,
            value=value_dollars,
            event_id=f"tattoo_{client['id']}",
        )

        name = f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()
        if capi_result["success"]:
            supabase.table("clients").update({"capi_status": "enviado"}).eq("id", client["id"]).execute()
            sent += 1
            results.append(CapiSyncResult(client_id=client["id"], client_name=name, success=True))
        else:
            failed += 1
            results.append(CapiSyncResult(
                client_id=client["id"],
                client_name=name,
                success=False,
                error=capi_result.get("error", "Unknown"),
            ))

    return CapiSyncResponse(
        total=len(pending.data),
        sent=sent,
        failed=failed,
        results=results,
    )


# ── Start ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
