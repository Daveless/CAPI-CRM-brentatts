import { useState, type ReactNode } from "react"
import type { AppView } from "../lib/types"
import { supabase } from "../lib/supabase"

type LayoutProps = {
  view: AppView
  setView: (v: AppView) => void
  email: string
  children: ReactNode
}

const navItems: { key: AppView; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "clientes", label: "Clientes", icon: "👤" },
  { key: "sincronizar", label: "Sincronizar CAPI", icon: "🔄" },
]

export function Layout({ view, setView, email, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem("sb-token")
    window.location.reload()
  }

  const navigate = (v: AppView) => {
    setView(v)
    setSidebarOpen(false)
  }

  const currentLabel = navItems.find((n) => n.key === view)?.label || "Tattoo CRM"

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-piedra-900 border-b border-piedra-700 shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-stone-200 hover:text-achiote transition-colors text-xl leading-none"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <span className="text-sm font-semibold text-stone-200 font-[family-name:var(--font-heading)]">
          {currentLabel}
        </span>
        <button
          onClick={signOut}
          className="text-piedra-400 hover:text-stone-200 text-sm transition-colors"
        >
          Salir
        </button>
      </header>

      {/* Backdrop (mobile only) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-56 bg-piedra-900 border-r border-piedra-700 flex flex-col shrink-0 transition-transform md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-piedra-700 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-200 font-[family-name:var(--font-heading)]">
              Tattoo CRM
            </h1>
            <p className="text-piedra-400 text-xs mt-0.5">{email}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-piedra-400 hover:text-stone-200 text-xl leading-none"
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                view === item.key
                  ? "bg-achiote-dim text-achiote font-medium"
                  : "text-piedra-400 hover:text-stone-200 hover:bg-piedra-800"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-piedra-700 hidden md:block">
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-piedra-400 hover:text-stone-200 hover:bg-piedra-800 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-3 md:p-6">
        {children}
      </main>
    </div>
  )
}
