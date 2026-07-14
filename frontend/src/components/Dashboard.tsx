import type { DashboardStats } from "../lib/types"

type Props = {
  data: DashboardStats | null
  loading: boolean
}

const centsToDollars = (c: number) => `$${(c / 100).toFixed(2)}`

export function Dashboard({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-stone-200 font-[family-name:var(--font-heading)]">Dashboard</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-piedra-900 border border-piedra-700 rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-piedra-700 rounded w-20 mb-2" />
              <div className="h-6 bg-piedra-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const kpis = [
    { label: "Clientes totales", value: data.total_clients.toString() },
    { label: "Ingresos totales", value: centsToDollars(data.total_income), accent: true },
    { label: "Gasto materiales", value: centsToDollars(data.total_cost) },
    { label: "Rentabilidad", value: centsToDollars(data.profit), accent: data.profit >= 0 },
    { label: "Pendientes CAPI", value: data.pending_capi.toString() },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-stone-200 font-[family-name:var(--font-heading)]">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-piedra-900 border border-piedra-700 rounded-xl p-5">
            <div className="text-xs text-piedra-400 mb-1">{kpi.label}</div>
            <div className={`text-2xl font-bold font-[family-name:var(--font-heading)] ${
              kpi.accent === true ? "text-achiote" : kpi.accent === false ? "text-red-400" : "text-stone-200"
            }`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-200 mb-3">Desglose mensual</h3>
        <div className="bg-piedra-900 border border-piedra-700 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-piedra-700 text-piedra-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Mes</th>
                <th className="text-right px-4 py-3 font-medium">Clientes</th>
                <th className="text-right px-4 py-3 font-medium">Ingresos</th>
                <th className="text-right px-4 py-3 font-medium">Gastos</th>
                <th className="text-right px-4 py-3 font-medium">Rentabilidad</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-piedra-400">
                    Sin datos mensuales aún
                  </td>
                </tr>
              )}
              {data.monthly.map((m) => (
                <tr key={m.month} className="border-b border-piedra-800 hover:bg-piedra-800/50">
                  <td className="px-4 py-3 text-stone-200 font-medium">{m.month}</td>
                  <td className="px-4 py-3 text-right text-stone-300">{m.client_count}</td>
                  <td className="px-4 py-3 text-right text-stone-300">{centsToDollars(m.total_income)}</td>
                  <td className="px-4 py-3 text-right text-stone-300">{centsToDollars(m.total_cost)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${m.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {centsToDollars(m.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
