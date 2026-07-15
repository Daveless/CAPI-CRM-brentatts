import { useState } from "react"
import type { CapiSyncResponse } from "../lib/types"
import { syncCapi } from "../lib/api"
import { Btn } from "./ui/Btn"

type Props = {
  pendingCount: number
  metaToken: string
  setMetaToken: (token: string) => void
  onSyncComplete: () => void
}

export function CapiSync({ pendingCount, metaToken, setMetaToken, onSyncComplete }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CapiSyncResponse | null>(null)
  const [error, setError] = useState("")

  const handleSync = async () => {
    if (!metaToken.trim()) {
      setError("Ingresa el token de acceso de Meta")
      return
    }
    setError("")
    setLoading(true)
    setResult(null)
    try {
      const data = await syncCapi(metaToken.trim())
      setResult(data)
      onSyncComplete()
    } catch {
      setError("Error al sincronizar con Meta CAPI")
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-bold text-stone-200 font-[family-name:var(--font-heading)]">
        Sincronizar CAPI
      </h2>

      <div className="bg-piedra-900 border border-piedra-700 rounded-xl p-6 space-y-4">
        <p className="text-sm text-piedra-300">
          Envía eventos pendientes de <strong>Lead</strong> y <strong>Purchase</strong> a Meta
          a través de la Conversions API.
        </p>

        <div className="bg-piedra-800 border border-piedra-600 rounded-lg p-4">
          <div className="text-xs text-piedra-400 mb-1">Pendientes de envío</div>
          <div className="text-3xl font-bold text-stone-200 font-[family-name:var(--font-heading)]">
            {pendingCount}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-piedra-400">Token de acceso de Meta</label>
          <input
            type="password"
            value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)}
            placeholder="EAAV7pUskousBR..."
            className="bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote font-mono"
          />
          <p className="text-xs text-piedra-400">
            Este token se usa automáticamente al crear clientes y al marcarlos como completados.
          </p>
        </div>

        {error && <div className="text-sm text-red-400 bg-red-400/10 rounded-lg p-3">{error}</div>}

        <Btn
          onClick={handleSync}
          accent
          loading={loading}
          disabled={pendingCount === 0}
          label={pendingCount === 0 ? "Sin pendientes" : "Sincronizar ahora"}
        />
      </div>

      {result && (
        <div className="bg-piedra-900 border border-piedra-700 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-stone-200">Resultado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-piedra-800 rounded-lg p-3 text-center">
              <div className="text-xs text-piedra-400">Total</div>
              <div className="text-xl font-bold text-stone-200">{result.total}</div>
            </div>
            <div className="bg-piedra-800 rounded-lg p-3 text-center">
              <div className="text-xs text-piedra-400">Enviados</div>
              <div className="text-xl font-bold text-green-400">{result.sent}</div>
            </div>
            <div className="bg-piedra-800 rounded-lg p-3 text-center">
              <div className="text-xs text-piedra-400">Fallidos</div>
              <div className={`text-xl font-bold ${result.failed > 0 ? "text-red-400" : "text-stone-200"}`}>
                {result.failed}
              </div>
            </div>
          </div>

          {result.results.length > 0 && (
            <div className="space-y-1 mt-3">
              {result.results.map((r) => (
                <div key={`${r.client_id}-${r.event_type}`}
                  className={`text-xs px-3 py-2 rounded-lg flex items-center justify-between ${
                    r.success ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"
                  }`}>
                  <span>
                    {r.client_name}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.event_type === "lead"
                        ? "bg-maiz-dim text-maiz"
                        : "bg-achiote-dim text-achiote"
                    }`}>
                      {r.event_type === "lead" ? "Lead" : "Purchase"}
                    </span>
                  </span>
                  <span>{r.success ? "Enviado" : r.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
