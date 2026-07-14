import { supabase } from "./supabase"

const BASE = "/api"

function getToken(): string {
  const stored = localStorage.getItem("sb-token")
  return stored || ""
}

function headers(metaToken?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) h["Authorization"] = `Bearer ${token}`
  if (metaToken) h["X-Meta-Token"] = metaToken
  return h
}

async function handleUnauthorized() {
  localStorage.removeItem("sb-token")
  await supabase.auth.signOut()
}

export async function apiGet(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: headers() })
  if (r.status === 401) {
    await handleUnauthorized()
    throw new Error("Unauthorized")
  }
  return r.json()
}

export async function apiPost(path: string, body: unknown, metaToken?: string) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(metaToken),
    body: JSON.stringify(body),
  })
  if (r.status === 401) {
    await handleUnauthorized()
    throw new Error("Unauthorized")
  }
  return r.json()
}

export async function apiPut(path: string, body: unknown, metaToken?: string) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: headers(metaToken),
    body: JSON.stringify(body),
  })
  if (r.status === 401) {
    await handleUnauthorized()
    throw new Error("Unauthorized")
  }
  return r.json()
}

export async function apiDelete(path: string) {
  const r = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
  })
  if (r.status === 401) {
    await handleUnauthorized()
    throw new Error("Unauthorized")
  }
  return r.json()
}

// ── Client API ──────────────────────────────────────────────────────

import type { Client, DashboardStats, CapiSyncResponse } from "./types"

export async function fetchClients(status = ""): Promise<Client[]> {
  const qs = status ? `?status=${status}` : ""
  return apiGet(`/clients${qs}`)
}

export async function fetchDashboard(): Promise<DashboardStats> {
  return apiGet("/dashboard")
}

export async function createClient(data: Partial<Client>, metaToken?: string): Promise<Client> {
  return apiPost("/clients", data, metaToken)
}

export async function updateClient(id: string, data: Partial<Client>, metaToken?: string): Promise<Client> {
  return apiPut(`/clients/${id}`, data, metaToken)
}

export async function deleteClient(id: string): Promise<{ ok: boolean }> {
  return apiDelete(`/clients/${id}`)
}

export async function syncCapi(accessToken: string): Promise<CapiSyncResponse> {
  return apiPost("/capi/sync", { access_token: accessToken })
}
