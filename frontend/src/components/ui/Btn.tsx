import type { ReactNode } from "react"

export function Btn({
  onClick, label, loading, accent, children, disabled,
}: {
  onClick?: () => void
  label?: string
  loading?: boolean
  accent?: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      type="button"
      className={`${accent
        ? "bg-achiote hover:bg-[#e64a2a] text-white shadow-sm shadow-achiote/20"
        : "bg-piedra-800 hover:bg-piedra-700 text-stone-200 border border-piedra-600 hover:border-piedra-500"} disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200`}>
      {loading
        ? <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /></span>
        : (children || label || "")}
    </button>
  )
}
