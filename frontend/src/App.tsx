import { useState, useEffect, useCallback } from "react"
import type { Client, AppView, ClientTab } from "./lib/types"
import { supabase } from "./lib/supabase"
import { fetchClients, fetchDashboard, createClient, updateClient, deleteClient } from "./lib/api"
import type { DashboardStats } from "./lib/types"
import { Login } from "./components/Login"
import { Layout } from "./components/Layout"
import { Dashboard } from "./components/Dashboard"
import { ClientList } from "./components/ClientList"
import { ClientForm } from "./components/ClientForm"
import { CapiSync } from "./components/CapiSync"
import { MetaNotif } from "./components/MetaNotif"

export default function App() {
  const [session, setSession] = useState<boolean | null>(null)
  const [email, setEmail] = useState("")
  const [view, setView] = useState<AppView>("dashboard")

  const [clients, setClients] = useState<Client[]>([])
  const [tab, setTab] = useState<ClientTab>("todos")
  const [clientsLoading, setClientsLoading] = useState(false)

  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)
  const [dashLoading, setDashLoading] = useState(false)

  const [metaToken, setMetaToken] = useState("")
  const [capiNotifs, setCapiNotifs] = useState<{ type: "success" | "error"; msg: string }[]>([])

  const dismissNotif = (index: number) => {
    setCapiNotifs((prev) => prev.filter((_, i) => i !== index))
  }

  const loadClients = useCallback(async (status = "") => {
    setClientsLoading(true)
    try {
      const data = await fetchClients(status)
      setClients(Array.isArray(data) ? data : [])
    } catch {
      setClients([])
    }
    setClientsLoading(false)
  }, [])

  const loadDashboard = useCallback(async () => {
    setDashLoading(true)
    try {
      const data = await fetchDashboard()
      setDashboard(data)
    } catch {
      setDashboard(null)
    }
    setDashLoading(false)
  }, [])

  useEffect(() => {
    if (view !== "clientes") return
    if (tab === "pendientes_capi") {
      setClientsLoading(true)
      fetchClients("").then((all) => {
        const arr = all as Client[]
        const pending = arr.filter(
          (c) =>
            (c.status === "adelanto_pagado" && !c.lead_synced_at) ||
            (c.status === "completado" && !c.purchase_synced_at)
        )
        setClients(pending)
        setClientsLoading(false)
      }).catch(() => {
        setClients([])
        setClientsLoading(false)
      })
    } else if (tab === "todos") {
      loadClients("")
    } else {
      loadClients(tab)
    }
  }, [tab, view, loadClients])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(true)
        setEmail(session.user.email || "")
        localStorage.setItem("sb-token", session.access_token)
      } else {
        setSession(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(true)
        setEmail(session.user.email || "")
        localStorage.setItem("sb-token", session.access_token)
      } else {
        setSession(false)
        setEmail("")
        localStorage.removeItem("sb-token")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (view === "dashboard" && session === true) loadDashboard()
  }, [view, session, loadDashboard])

  const handleNew = () => {
    setEditingClient(null)
    setFormOpen(true)
  }

  const handleEdit = (c: Client) => {
    setEditingClient(c)
    setFormOpen(true)
  }

  const addNotif = (type: "success" | "error", msg: string) => {
    const id = Date.now()
    setCapiNotifs((prev) => [...prev, { type, msg }])
    setTimeout(() => {
      setCapiNotifs((prev) => prev.filter((_, i) => prev.length - 1 !== i || prev[prev.length - 1] !== undefined))
    }, 6000)
  }

  const handleSave = async (data: Partial<Client>) => {
    try {
      let result: Client
      if (editingClient) {
        result = await updateClient(editingClient.id, data, metaToken || undefined)
      } else {
        result = await createClient(data, metaToken || undefined)
      }
      if (result.meta_event) {
        if (result.meta_event.type === "lead+purchase" && result.meta_event.lead && result.meta_event.purchase) {
          addNotif(
            result.meta_event.lead.success && result.meta_event.purchase.success ? "success" : "error",
            `Lead: ${result.meta_event.lead.success ? "enviado" : "error"} | Purchase: ${result.meta_event.purchase.success ? "enviado" : "error"}`
          )
        } else {
          addNotif(
            result.meta_event.success ? "success" : "error",
            result.meta_event.success
              ? `Evento "${result.meta_event.type}" enviado a Meta`
              : `Error Meta: ${result.meta_event.error || "desconocido"}`
          )
        }
      }
    } catch {
      return
    }
    setFormOpen(false)
    setEditingClient(null)
    loadClients(tab === "todos" ? "" : tab)
    if (view === "dashboard") loadDashboard()
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id)
    } catch {
      return
    }
    loadClients(tab === "todos" ? "" : tab)
    if (view === "dashboard") loadDashboard()
  }

  const handleSyncComplete = () => {
    loadDashboard()
    if (tab === "pendientes_capi") {
      fetchClients("").then((all) => {
        const arr = all as Client[]
        setClients(
          arr.filter(
            (c) =>
              (c.status === "adelanto_pagado" && !c.lead_synced_at) ||
              (c.status === "completado" && !c.purchase_synced_at)
          )
        )
      })
    }
  }

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-piedra-950">
        <div className="w-6 h-6 border-2 border-achiote border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <Layout view={view} setView={setView} email={email}>
      {capiNotifs.map((n, i) => (
        <MetaNotif key={i} type={n.type} msg={n.msg} onDismiss={() => dismissNotif(i)} />
      ))}
      {view === "dashboard" && <Dashboard data={dashboard} loading={dashLoading} />}
      {view === "clientes" && (
        <ClientList
          clients={clients}
          tab={tab}
          setTab={setTab}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNew={handleNew}
        />
      )}
      {view === "sincronizar" && (
        <CapiSync
          pendingCount={dashboard?.pending_capi ?? 0}
          metaToken={metaToken}
          setMetaToken={setMetaToken}
          onSyncComplete={handleSyncComplete}
        />
      )}

      <ClientForm
        open={formOpen}
        client={editingClient}
        onClose={() => { setFormOpen(false); setEditingClient(null) }}
        onSave={handleSave}
      />
    </Layout>
  )
}
