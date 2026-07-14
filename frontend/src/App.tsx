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

  // clients state
  const [clients, setClients] = useState<Client[]>([])
  const [tab, setTab] = useState<ClientTab>("todos")
  const [clientsLoading, setClientsLoading] = useState(false)

  // form state
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // dashboard
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)
  const [dashLoading, setDashLoading] = useState(false)

  // meta token & notifications
  const [metaToken, setMetaToken] = useState("")
  const [capiNotif, setCapiNotif] = useState<{ type: "success" | "error"; msg: string } | null>(null)

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

  // handle tab change
  useEffect(() => {
    if (view !== "clientes") return
    if (tab === "pendientes_capi") {
      setClientsLoading(true)
      fetchClients("completado").then((all) => {
        const pending = (all as Client[]).filter((c) => c.capi_status === "no_enviado")
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

  // auth
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

  // auto-dismiss capi notification
  useEffect(() => {
    if (capiNotif) {
      const t = setTimeout(() => setCapiNotif(null), 5000)
      return () => clearTimeout(t)
    }
  }, [capiNotif])

  // load dashboard when entering dashboard view
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

  const handleSave = async (data: Partial<Client>) => {
    try {
      let result: Client
      if (editingClient) {
        result = await updateClient(editingClient.id, data, metaToken || undefined)
      } else {
        result = await createClient(data, metaToken || undefined)
      }
      if (result.meta_event) {
        setCapiNotif({
          type: result.meta_event.success ? "success" : "error",
          msg: result.meta_event.success
            ? `Evento "${result.meta_event.type}" enviado a Meta`
            : `Error Meta: ${result.meta_event.error || "desconocido"}`,
        })
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
      {capiNotif && (
        <MetaNotif type={capiNotif.type} msg={capiNotif.msg} onDismiss={() => setCapiNotif(null)} />
      )}
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
