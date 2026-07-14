import { useState, useEffect } from "react"
import type { Client } from "../lib/types"
import { Btn } from "./ui/Btn"
import { Field } from "./ui/Field"

type Props = {
  open: boolean
  client: Client | null
  onClose: () => void
  onSave: (data: Partial<Client>) => Promise<void>
}

export function ClientForm({ open, client, onClose, onSave }: Props) {
  const [first_name, setFirstName] = useState("")
  const [last_name, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zip, setZip] = useState("")
  const [country, setCountry] = useState("US")
  const [tattoo_price, setTattooPrice] = useState("")
  const [material_cost, setMaterialCost] = useState("")
  const [appointment_date, setAppointmentDate] = useState("")
  const [status, setStatus] = useState<"adelanto_pagado" | "completado">("adelanto_pagado")
  const [tattoo_description, setTattooDescription] = useState("")
  const [meta_lead_id, setMetaLeadId] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (client) {
      setFirstName(client.first_name)
      setLastName(client.last_name)
      setEmail(client.email)
      setPhone(client.phone)
      setCity(client.city)
      setState(client.state)
      setZip(client.zip)
      setCountry(client.country)
      setTattooPrice((client.tattoo_price / 100).toString())
      setMaterialCost((client.material_cost / 100).toString())
      setAppointmentDate(client.appointment_date || "")
      setStatus(client.status)
      setTattooDescription(client.tattoo_description || "")
      setMetaLeadId(client.meta_lead_id || "")
    } else {
      setFirstName(""); setLastName(""); setEmail(""); setPhone("")
      setCity(""); setState(""); setZip(""); setCountry("US")
      setTattooPrice(""); setMaterialCost(""); setAppointmentDate("")
      setStatus("adelanto_pagado"); setTattooDescription(""); setMetaLeadId("")
    }
  }, [client, open])

  if (!open) return null

  const handleSubmit = async () => {
    setLoading(true)
    const data: Record<string, unknown> = {
      first_name,
      last_name,
      email,
      phone,
      city,
      state,
      zip,
      country,
      tattoo_price: Math.round(parseFloat(tattoo_price || "0") * 100),
      material_cost: Math.round(parseFloat(material_cost || "0") * 100),
      appointment_date: appointment_date || null,
      status,
      tattoo_description,
      meta_lead_id: meta_lead_id || null,
    }
    await onSave(data as Partial<Client>)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-piedra-900 border border-piedra-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-200 font-[family-name:var(--font-heading)]">
              {client ? "Editar cliente" : "Nuevo cliente"}
            </h2>
            <button onClick={onClose} className="text-piedra-400 hover:text-stone-200 text-xl leading-none">&times;</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre" val={first_name} set={setFirstName} />
            <Field label="Apellido" val={last_name} set={setLastName} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email" val={email} set={setEmail} type="email" />
            <Field label="Teléfono" val={phone} set={setPhone} type="tel" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Ciudad" val={city} set={setCity} />
            <Field label="Estado" val={state} set={setState} />
            <Field label="Código postal" val={zip} set={setZip} />
          </div>
          <Field label="País (código)" val={country} set={setCountry} compact />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-piedra-400">Precio tatuaje (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-piedra-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" value={tattoo_price}
                  onChange={e => setTattooPrice(e.target.value)}
                  className="w-full bg-piedra-900 border border-piedra-600 rounded-lg pl-7 pr-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-piedra-400">Gasto materiales (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-piedra-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" value={material_cost}
                  onChange={e => setMaterialCost(e.target.value)}
                  className="w-full bg-piedra-900 border border-piedra-600 rounded-lg pl-7 pr-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-piedra-400">Fecha de cita</label>
              <input type="date" value={appointment_date}
                onChange={e => setAppointmentDate(e.target.value)}
                className="bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-piedra-400">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value as "adelanto_pagado" | "completado")}
                className="bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote">
                <option value="adelanto_pagado">Adelanto pagado</option>
                <option value="completado">Completado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-piedra-400">Descripción del tatuaje</label>
            <textarea value={tattoo_description} onChange={e => setTattooDescription(e.target.value)} rows={2}
              className="bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote resize-none" />
          </div>

          {status === "adelanto_pagado" && (
            <div className="bg-piedra-800 border border-piedra-600 rounded-lg p-3 text-xs text-piedra-300">
              Depósito: $10.00 (fijo)
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-piedra-400">Meta Lead ID (opcional)</label>
            <input type="text" value={meta_lead_id}
              onChange={e => setMetaLeadId(e.target.value)}
              placeholder="ID del lead de Meta (15-17 dígitos)"
              className="bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote font-mono" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn onClick={onClose} label="Cancelar" />
            <Btn onClick={handleSubmit} accent loading={loading} label={client ? "Guardar cambios" : "Crear cliente"} />
          </div>
        </div>
      </div>
    </div>
  )
}
