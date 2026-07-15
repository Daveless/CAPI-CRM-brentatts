import logging
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
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

app = FastAPI(title="Tattoo CRM", version="2.0.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://capi-crm-brentatts.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.options("/{full_path:path}")
async def preflight_handler(full_path: str = ""):
    resp = Response()
    resp.headers["Access-Control-Allow-Origin"] = "https://capi-crm-brentatts.vercel.app"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS, POST, PUT, DELETE"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Meta-Token, X-Client-User-Agent"
    return resp


DEPOSIT_CENTS = 1000


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
        country=row.get("country", "EC"),
        tattoo_price=row.get("tattoo_price", 0),
        deposit=row.get("deposit", DEPOSIT_CENTS),
        material_cost=row.get("material_cost", 0),
        appointment_date=row.get("appointment_date"),
        status=row.get("status", "adelanto_pagado"),
        capi_status=row.get("capi_status"),
        lead_synced_at=row.get("lead_synced_at"),
        purchase_synced_at=row.get("purchase_synced_at"),
        tattoo_description=row.get("tattoo_description", ""),
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
        "country": client.get("country", "EC"),
    }


def _get_event_source_url(request: Request) -> str:
    origin = request.headers.get("origin", "")
    if origin:
        return origin
    return request.headers.get("referer", "")


def _get_client_user_agent(request: Request) -> str:
    return request.headers.get("X-Client-User-Agent", "")


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
    request: Request,
    user_id: str = Depends(get_current_user),
    x_meta_token: Optional[str] = Header(None, alias="X-Meta-Token"),
):
    supabase = get_supabase()
    data = body.model_dump(mode="json")
    data["user_id"] = user_id
    data["deposit"] = DEPOSIT_CENTS

    if body.status == "completado":
        data["capi_status"] = "no_enviado"

    result = supabase.table("clients").insert(data).execute()
    if not result.data:
        raise HTTPException(500, "Error al crear cliente")

    client_row = result.data[0]
    response = _row_to_client(client_row)

    if not x_meta_token:
        return response

    event_source_url = _get_event_source_url(request)
    client_user_agent = _get_client_user_agent(request)

    # ── Send Lead event ──
    if settings.qualified_leads_dataset_id:
        user_data = _extract_user_data(client_row)
        lead_result = await send_lead_event(
            dataset_id=settings.qualified_leads_dataset_id,
            access_token=x_meta_token,
            user_data=user_data,
            event_name="Lead",
            event_id=f"lead_{client_row['id']}",
            event_source_url=event_source_url,
            client_user_agent=client_user_agent,
            test_event_code=settings.test_event_code,
        )
        response.meta_event = {"type": "lead", **lead_result}
        if lead_result["success"]:
            supabase.table("clients").update(
                {"lead_synced_at": "now()"}
            ).eq("id", client_row["id"]).execute()
        else:
            logger.warning("Lead event failed for client %s: %s", client_row["id"], lead_result.get("error"))

    # ── If created as completado, also send Purchase ──
    if body.status == "completado" and settings.conversions_pixel_id:
        user_data = _extract_user_data(client_row)
        value_dollars = client_row.get("tattoo_price", 0) / 100.0
        purchase_result = await send_purchase_event(
            pixel_id=settings.conversions_pixel_id,
            access_token=x_meta_token,
            user_data=user_data,
            value=value_dollars,
            event_id=f"tattoo_{client_row['id']}",
            event_source_url=event_source_url,
            client_user_agent=client_user_agent,
            test_event_code=settings.test_event_code,
        )
        if response.meta_event:
            response.meta_event = {"type": "lead+purchase", "lead": response.meta_event, "purchase": purchase_result}
        else:
            response.meta_event = {"type": "purchase", **purchase_result}

        if purchase_result["success"]:
            supabase.table("clients").update({
                "capi_status": "enviado",
                "purchase_synced_at": "now()",
            }).eq("id", client_row["id"]).execute()
            response.capi_status = "enviado"
        else:
            logger.warning("Purchase event failed for client %s: %s", client_row["id"], purchase_result.get("error"))

    return response


@app.put("/api/clients/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    request: Request,
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

    if not (transitioning_to_completado and x_meta_token and settings.conversions_pixel_id):
        return response

    event_source_url = _get_event_source_url(request)
    client_user_agent = _get_client_user_agent(request)
    user_data = _extract_user_data(client_row)
    value_dollars = client_row.get("tattoo_price", 0) / 100.0

    purchase_result = await send_purchase_event(
        pixel_id=settings.conversions_pixel_id,
        access_token=x_meta_token,
        user_data=user_data,
        value=value_dollars,
        event_id=f"tattoo_{client_id}",
        event_source_url=event_source_url,
        client_user_agent=client_user_agent,
        test_event_code=settings.test_event_code,
    )

    response.meta_event = {"type": "purchase", **purchase_result}
    if purchase_result["success"]:
        supabase.table("clients").update({
            "capi_status": "enviado",
            "purchase_synced_at": "now()",
        }).eq("id", client_id).execute()
        response.capi_status = "enviado"
    else:
        logger.warning("Purchase event failed for client %s: %s", client_id, purchase_result.get("error"))

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

    total_income = 0
    total_cost = 0
    for c in clients:
        total_cost += c.get("material_cost", 0)
        if c.get("status") == "completado":
            total_income += c.get("tattoo_price", 0)
        elif c.get("status") == "adelanto_pagado":
            total_income += DEPOSIT_CENTS

    profit = total_income - total_cost

    pending = sum(
        1 for c in clients
        if (c.get("status") == "adelanto_pagado" and not c.get("lead_synced_at"))
        or (c.get("status") == "completado" and not c.get("purchase_synced_at"))
    )

    monthly: dict[str, dict] = {}
    for c in clients:
        if c.get("created_at"):
            m = c["created_at"][:7]
            if m not in monthly:
                monthly[m] = {"total_income": 0, "total_cost": 0, "client_count": 0}
            monthly[m]["client_count"] += 1
            monthly[m]["total_cost"] += c.get("material_cost", 0)
            if c.get("status") == "completado":
                monthly[m]["total_income"] += c.get("tattoo_price", 0)
            elif c.get("status") == "adelanto_pagado":
                monthly[m]["total_income"] += DEPOSIT_CENTS

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
    request: Request,
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
        event_id="test_lead_001",
        event_source_url=_get_event_source_url(request),
        client_user_agent=_get_client_user_agent(request),
        test_event_code="TEST63899",
    )
    return result


# ── CAPI Sync ────────────────────────────────────────────────────────

@app.post("/api/capi/sync", response_model=CapiSyncResponse)
async def capi_sync(
    body: CapiSyncRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
):
    supabase = get_supabase()
    event_source_url = _get_event_source_url(request)
    client_user_agent = _get_client_user_agent(request)

    token_preview = body.access_token[:30] if body.access_token else "EMPTY"
    logger.info("CAPI sync token: len=%d prefix=%r full=%r", len(body.access_token), token_preview, body.access_token[:60])

    try:
        raw_body = await request.body()
        logger.info("CAPI sync raw body: %r", raw_body.decode()[:200])
    except Exception:
        pass

    clients = supabase.table("clients").select("*").eq("user_id", user_id).execute()
    if not clients.data:
        return CapiSyncResponse(total=0, sent=0, failed=0, results=[])

    results: list[CapiSyncResult] = []
    sent = 0
    failed = 0

    for client in clients.data:
        user_data = {
            "email": client.get("email", ""),
            "phone": client.get("phone", ""),
            "first_name": client.get("first_name", ""),
            "last_name": client.get("last_name", ""),
            "city": client.get("city", ""),
            "state": client.get("state", ""),
            "zip": client.get("zip", ""),
            "country": client.get("country", "EC"),
        }
        name = f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()
        cid = client["id"]

        # ── Sync pending Lead event ──
        if not client.get("lead_synced_at") and settings.qualified_leads_dataset_id:
            lead_result = await send_lead_event(
                dataset_id=settings.qualified_leads_dataset_id,
                access_token=body.access_token,
                user_data=user_data,
                event_name="Lead",
                event_id=f"lead_{cid}",
                event_source_url=event_source_url,
                client_user_agent=client_user_agent,
                test_event_code=settings.test_event_code,
            )
            if lead_result["success"]:
                supabase.table("clients").update({"lead_synced_at": "now()"}).eq("id", cid).execute()
                sent += 1
                results.append(CapiSyncResult(client_id=cid, client_name=name, success=True, event_type="lead"))
            else:
                failed += 1
                results.append(CapiSyncResult(
                    client_id=cid, client_name=name, success=False,
                    event_type="lead", error=lead_result.get("error", "Unknown"),
                ))

        # ── Sync pending Purchase event ──
        if (
            client.get("status") == "completado"
            and not client.get("purchase_synced_at")
            and settings.conversions_pixel_id
        ):
            value_dollars = client.get("tattoo_price", 0) / 100.0

            purchase_result = await send_purchase_event(
                pixel_id=settings.conversions_pixel_id,
                access_token=body.access_token,
                user_data=user_data,
                value=value_dollars,
                event_id=f"tattoo_{cid}",
                event_source_url=event_source_url,
                client_user_agent=client_user_agent,
                test_event_code=settings.test_event_code,
            )
            if purchase_result["success"]:
                supabase.table("clients").update({
                    "capi_status": "enviado",
                    "purchase_synced_at": "now()",
                }).eq("id", cid).execute()
                sent += 1
                results.append(CapiSyncResult(client_id=cid, client_name=name, success=True, event_type="purchase"))
            else:
                failed += 1
                results.append(CapiSyncResult(
                    client_id=cid, client_name=name, success=False,
                    event_type="purchase", error=purchase_result.get("error", "Unknown"),
                ))

    return CapiSyncResponse(
        total=sent + failed,
        sent=sent,
        failed=failed,
        results=results,
    )


# ── Start ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
