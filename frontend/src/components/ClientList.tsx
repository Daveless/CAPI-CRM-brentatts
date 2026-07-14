import { useState } from "react"
import type { Client, ClientTab } from "../lib/types"
import { Btn } from "./ui/Btn"

type Props = {
  clients: Client[]
  tab: ClientTab
  setTab: (t: ClientTab) => void
  onEdit: (c: Client) => void
  onDelete: (id: string) => void
  onNew: () => void
}

const tabs: { key: ClientTab; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "adelanto_pagado", label: "Adelanto" },
  { key: "completado", label: "Completados" },
  { key: "pendientes_capi", label: "Pendientes CAPI" },
]

const syncBadge = (label: string, synced_at: string | null) => {
  if (synced_at) {
    return <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded font-medium">{label} OK</span>
  }
  return <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-medium">{label} pend</span>
}

const statusCell = (c: Client) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5 flex-wrap">
      {c.status === "adelanto_pagado" && (
        <span className="text-xs bg-maiz-dim text-maiz px-2 py-0.5 rounded-full font-medium">Adelanto</span>
      )}
      {c.status === "completado" && c.capi_status === "enviado" && (
        <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full font-medium">Enviado</span>
      )}
      {c.status === "completado" && c.capi_status !== "enviado" && (
        <span className="text-xs bg-achiote-dim text-achiote px-2 py-0.5 rounded-full font-medium">No enviado</span>
      )}
    </div>
    <div className="flex items-center gap-1 flex-wrap">
      {syncBadge("Lead", c.lead_synced_at)}
      {c.status === "completado" && syncBadge("Purchase", c.purchase_synced_at)}
    </div>
  </div>
)

const centsToDollars = (c: number) => `$${(c / 100).toFixed(2)}`

export function ClientList({ clients, tab, setTab, onEdit, onDelete, onNew }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-piedra-900 rounded-lg p-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t.key ? "bg-piedra-700 text-stone-200" : "text-piedra-400 hover:text-stone-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Btn onClick={onNew} accent label="+ Nuevo cliente" />
      </div>

      <div className="bg-piedra-900 rounded-xl border border-piedra-700 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-piedra-700 text-piedra-400 text-xs">
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 font-medium">Contacto</th>
              <th className="text-left px-4 py-3 font-medium">Precio</th>
              <th className="text-left px-4 py-3 font-medium">Materiales</th>
              <th className="text-left px-4 py-3 font-medium">Estado / Sync</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-piedra-400">
                  No hay clientes aún. ¡Crea el primero!
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-piedra-800 hover:bg-piedra-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-200">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-piedra-400">
                    {c.appointment_date ? new Date(c.appointment_date).toLocaleDateString("es-ES") : "Sin fecha"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-stone-300 text-xs">{c.email || "-"}</div>
                  <div className="text-piedra-400 text-xs">{c.phone || "-"}</div>
                </td>
                <td className="px-4 py-3 text-stone-200 font-medium">{centsToDollars(c.tattoo_price)}</td>
                <td className="px-4 py-3 text-stone-300">{centsToDollars(c.material_cost)}</td>
                <td className="px-4 py-3">{statusCell(c)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onEdit(c)}
                      className="text-xs text-piedra-400 hover:text-stone-200 px-2 py-1 rounded transition-colors">
                      Editar
                    </button>
                    {confirmDelete === c.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => { onDelete(c.id); setConfirmDelete(null) }}
                          className="text-xs text-red-400 hover:text-red-300 px-1 py-1 rounded">Sí</button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="text-xs text-piedra-400 hover:text-stone-200 px-1 py-1 rounded">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(c.id)}
                        className="text-xs text-piedra-400 hover:text-red-400 px-2 py-1 rounded transition-colors">
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
