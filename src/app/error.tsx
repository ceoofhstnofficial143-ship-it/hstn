"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an analytics service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-8 animate-bounce">
        <span className="text-3xl">⚠️</span>
      </div>
      
      <span className="text-caption uppercase tracking-[0.3em] text-primary font-bold mb-2">Protocol Interrupted</span>
      <h1 className="text-display text-4xl lg:text-6xl font-black italic uppercase tracking-tighter mb-6">Something went wrong</h1>
      
      <p className="text-body text-muted max-w-md mb-12">
        We encountered a technical anomaly in the HSTNLX matrix. The protocol has been temporarily suspended for your protection.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="luxury-button !bg-foreground !text-white !px-12"
        >
          Attempt Reset
        </button>
        <Link
          href="/"
          className="luxury-button !px-12"
        >
          Return to HQ
        </Link>
      </div>
      
      <div className="mt-16 pt-8 border-t border-border w-full max-w-lg">
        <p className="text-[10px] text-muted uppercase tracking-widest font-mono">
          Anomaly ID: {error.digest || "HSTNLX-G-999"}
        </p>
      </div>
    </div>
  )
}
