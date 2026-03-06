"use client"

import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function LoginPage() {

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    })
  }

  const loginWithEmail = async () => {
    const email = prompt("Enter your email")
    if (!email) return

    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000",
      },
    })

    alert("Check your email for login link")
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="luxury-card max-w-md w-full p-8 sm:p-12 space-y-8 sm:space-y-12">
        <header className="text-center">
          <Link href="/" className="text-h3 font-bold tracking-tight text-foreground hover:opacity-80 transition-smooth">
            HSTN <span className="text-primary">LUXURY</span>
          </Link>
          <h1 className="text-h2 mt-8 mb-4">Welcome Back</h1>
          <p className="text-caption uppercase tracking-widest font-bold">Access your exclusive collection</p>
        </header>

        <div className="space-y-4">
          <div>
            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-4 py-4 px-6 border border-border rounded-full text-caption font-bold uppercase tracking-widest hover:bg-accent/50 transition-smooth button-press"
            >
              <span>Continue with Google</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">Choose the Google account you want to use</p>
          </div>

          <button
            onClick={loginWithEmail}
            className="luxury-button w-full !text-[11px] uppercase tracking-[0.2em] font-bold"
          >
            Sign in with Email
          </button>
        </div>

        <footer className="text-center pt-8 border-t border-border">
          <p className="text-caption">
            Don't have an account? <Link href="/signup" className="text-primary font-bold hover:underline">Join the Circle</Link>
          </p>
        </footer>
      </div>
    </main>
  )
}