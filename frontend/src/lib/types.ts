export interface Client {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  state: string
  zip: string
  country: string
  tattoo_price: number
  deposit: number
  material_cost: number
  appointment_date: string | null
  status: "adelanto_pagado" | "completado"
  capi_status: "enviado" | "no_enviado" | null
  lead_synced_at: string | null
  purchase_synced_at: string | null
  tattoo_description: string
  created_at: string
  updated_at: string
  meta_event?: {
    type: string
    success: boolean
    error?: string
    events_received?: number
    lead?: { success: boolean; error?: string }
    purchase?: { success: boolean; error?: string }
  }
}

export interface MonthlyBreakdown {
  month: string
  total_income: number
  total_cost: number
  profit: number
  client_count: number
}

export interface DashboardStats {
  total_clients: number
  adelanto_count: number
  completado_count: number
  total_income: number
  total_cost: number
  profit: number
  pending_capi: number
  monthly: MonthlyBreakdown[]
}

export interface CapiSyncResult {
  client_id: string
  client_name: string
  success: boolean
  event_type: "lead" | "purchase"
  error: string
}

export interface CapiSyncResponse {
  total: number
  sent: number
  failed: number
  results: CapiSyncResult[]
}

export type ClientTab = "todos" | "adelanto_pagado" | "completado" | "pendientes_capi"
export type AppView = "dashboard" | "clientes" | "sincronizar"
