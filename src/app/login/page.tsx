"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(`Access Denied: ${error.message}`)
    } else {
      router.push("/")
    }
    setLoading(false)
  }

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      }
    })
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="luxury-card max-w-md w-full p-8 sm:p-12 space-y-10 sm:space-y-12">
        <header className="text-center">
          <Link href="/" className="text-h3 font-black tracking-tight text-foreground hover:opacity-80 transition-smooth uppercase">
            HSTN <span className="text-primary font-black italic">Archive</span>
          </Link>
          <h1 className="text-h2 mt-8 mb-4 uppercase tracking-tighter italic">Security Gateway</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted">Access your exclusive collection</p>
        </header>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest font-black text-muted ml-1">Digital Address</label>
            <input
              type="email"
              required
              placeholder="e.g. collector@nexus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-accent/10 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 ring-primary/20 transition-smooth"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[9px] uppercase tracking-widest font-black text-muted">Encrypted Key</label>
              <Link href="/forgot-password" className="text-[8px] uppercase tracking-widest font-bold text-primary hover:underline">Recovery</Link>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-accent/10 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 ring-primary/20 transition-smooth"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="luxury-button w-full !text-[11px] uppercase tracking-[0.3em] font-black shadow-xl"
          >
            {loading ? "Authenticating..." : "Authorize Access"}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold text-muted bg-background px-4">OR</div>
        </div>

        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-4 py-4 px-6 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all transition-premium"
        >
          <span>Continue with Google</span>
        </button>

        <footer className="text-center pt-8 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest font-bold">
            New to the network? <Link href="/signup" className="text-primary hover:underline ml-2">Register Session</Link>
          </p>
        </footer>
      </div>
    </main>
  )
}