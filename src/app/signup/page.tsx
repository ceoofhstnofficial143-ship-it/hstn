"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Supabase Auth Signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      alert(`Protocol Error: ${error.message}`)
      setLoading(false)
      return
    }

    if (data.user) {
      // 2. Profile Creation (Safe Sync)
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
        })

      alert("Welcome to the Circle. Please verify your email if required.")
      router.push("/login")
    }
    setLoading(false)
  }

  const signupWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      }
    })
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 animate-fade-in">
      <div className="luxury-card max-w-md w-full p-8 sm:p-12 space-y-10 sm:space-y-12">
        <header className="text-center">
          <Link href="/" className="text-h3 font-black tracking-tight text-foreground hover:opacity-80 transition-smooth uppercase">
            HSTNLX <span className="text-primary font-black italic">Circle</span>
          </Link>
          <h1 className="text-h2 mt-8 mb-4 uppercase tracking-tighter italic">Create Credentials</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted">Join the elite heritage marketplace</p>
        </header>

        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest font-black text-muted ml-1">Full Nomenclature</label>
            <input
              type="text"
              required
              placeholder="e.g. Johnathan Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-accent/10 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 ring-primary/20 transition-smooth"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest font-black text-muted ml-1">Digital Address (Email)</label>
            <input
              type="email"
              required
              placeholder="name@nexus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-accent/10 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 ring-primary/20 transition-smooth"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest font-black text-muted ml-1">Security Key (Password)</label>
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
            {loading ? "Establishing Link..." : "Initialize Membership"}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold text-muted bg-background px-4">OR</div>
        </div>

        <button
          onClick={signupWithGoogle}
          className="w-full flex items-center justify-center gap-4 py-4 px-6 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all transition-premium"
        >
          <span>Continue with Google</span>
        </button>

        <footer className="text-center pt-8 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest font-bold">
            Already authenticated? <Link href="/login" className="text-primary hover:underline ml-2">Sign In Protocol</Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

