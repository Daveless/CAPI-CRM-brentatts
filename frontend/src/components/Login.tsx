import { useState } from "react"
import { supabase } from "../lib/supabase"
import { Field } from "./ui/Field"
import { Btn } from "./ui/Btn"

export function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError("")
    if (!email || !password) {
      setError("Completa todos los campos")
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError("Credenciales inválidas")
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-piedra-950">
      <div className="bg-piedra-900 border border-piedra-700 rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-stone-200 font-[family-name:var(--font-heading)]">
            Tattoo CRM
          </h1>
          <p className="text-piedra-400 text-sm">Iniciar sesión</p>
        </div>

        <div className="space-y-3">
          <Field label="Email" val={email} set={setEmail} type="email" />
          <Field label="Contraseña" val={password} set={setPassword} type="password" />
        </div>

        {error && <div className="text-sm text-red-400 bg-red-400/10 rounded-lg p-3">{error}</div>}

        <Btn onClick={handleLogin} accent loading={loading} label="Entrar" />
      </div>
    </div>
  )
}
