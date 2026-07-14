type Props = {
  type: "success" | "error"
  msg: string
  onDismiss: () => void
}

export function MetaNotif({ type, msg, onDismiss }: Props) {
  const bg = type === "success" ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"
  const text = type === "success" ? "text-green-400" : "text-red-400"

  return (
    <div className={`fixed top-4 right-4 z-[100] max-w-sm border rounded-lg p-4 shadow-lg ${bg}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm ${text}`}>{msg}</p>
        <button onClick={onDismiss} className={`text-sm opacity-60 hover:opacity-100 ${text}`}>
          &times;
        </button>
      </div>
    </div>
  )
}
