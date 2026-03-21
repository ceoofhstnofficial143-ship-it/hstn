"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function SellerOnboarding() {
  const [storeName, setStoreName] = useState("")
  const [upiId, setUpiId] = useState("")
  const [loading, setLoading] = useState(false)
  const [kybStatus, setKybStatus] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const checkKyb = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push("/login")

      const { data } = await supabase
        .from("seller_kyb")
        .select("*")
        .eq("user_id", user.id)
        .single()
      
      if (data) setKybStatus(data)
    }
    checkKyb()
  }, [])

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("seller_kyb")
      .insert({
        user_id: user?.id,
        store_name: storeName,
        upi_id: upiId,
        is_verified: false // Admin must verify
      })

    if (error) {
      alert("Registration Failed: " + error.message)
    } else {
      window.location.reload()
    }
    setLoading(false)
  }

  if (kybStatus) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
           <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl border ${kybStatus.is_verified ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-yellow-500/10 border-yellow-500 text-yellow-500'}`}>
             {kybStatus.is_verified ? '✓' : '⌛'}
           </div>
           <div>
             <h1 className="text-3xl font-black uppercase italic tracking-tighter italic">
               {kybStatus.is_verified ? 'Protocol Verified' : 'Verification Pending'}
             </h1>
             <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-bold mt-4">
               {kybStatus.is_verified ? 'The Merchant Hub is now fully unlocked.' : 'The Institutional Audit is currently in progress.'}
             </p>
           </div>
           {kybStatus.is_verified && (
             <button onClick={() => router.push("/seller/dashboard")} className="luxury-button !bg-white !text-black w-full">Enter Command Center</button>
           )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white py-20 px-6 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <header className="mb-16">
          <span className="text-[10px] uppercase tracking-[0.5em] text-primary font-bold">New Merchant Enrollment</span>
          <h1 className="text-5xl md:text-7xl mt-4 italic font-black uppercase tracking-tighter leading-tight">
            Institutional <br/>Onboarding
          </h1>
          <p className="text-white/40 text-xs uppercase tracking-widest mt-6 max-w-lg leading-relaxed">
            Initialize your presence in the HSTNLX archive. Verified merchants gain access to global payouts and priority placement.
          </p>
        </header>

        <form onSubmit={handleOnboard} className="space-y-12">
           <div className="space-y-8">
              <div className="group">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-4 block group-focus-within:text-primary transition-colors">Merchant Alias (Store Name)</label>
                <input 
                  required
                  type="text" 
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. ELITE ARCHIVE"
                  className="w-full bg-transparent border-b-2 border-white/10 py-4 text-2xl font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-all placeholder:text-white/5"
                />
              </div>

              <div className="group">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-4 block group-focus-within:text-primary transition-colors">Payout Coordinate (UPI ID)</label>
                <input 
                  required
                  type="text" 
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. storename@okaxis"
                  className="w-full bg-transparent border-b-2 border-white/10 py-4 text-2xl font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-all placeholder:text-white/5"
                />
                <p className="text-[9px] text-white/20 uppercase tracking-widest mt-4">This will be the immutable destination for all acquisition revenue.</p>
              </div>
           </div>

           <button 
             disabled={loading}
             className="luxury-button w-full sm:w-auto !bg-primary !text-black !px-16 !py-5 font-black uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50"
           >
             {loading ? "Initializing..." : "Register Protocol"}
           </button>
        </form>
      </div>
    </main>
  )
}
