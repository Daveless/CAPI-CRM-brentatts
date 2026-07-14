type FieldProps = {
  label: string
  val: string
  set: (v: string) => void
  type?: string
  compact?: boolean
}

export function Field({ label, val, set, type, compact }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className={compact ? "text-[11px] text-piedra-400" : "text-xs text-piedra-400"}>{label}</label>
      <input type={type || "text"} value={val} onChange={e => set(e.target.value)}
        className={compact
          ? "bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-achiote"
          : "bg-piedra-900 border border-piedra-600 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-achiote"} />
    </div>
  )
}
