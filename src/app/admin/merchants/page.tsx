"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function MerchantAuditTerminal() {
    const [merchants, setMerchants] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchMerchants = async () => {
             const { data, error } = await (supabase as any)
                .from("seller_kyb")
                .select("*")
                .order("created_at", { ascending: false })
             
             if (!error && data) setMerchants(data)
             setLoading(false)
        }
        fetchMerchants()
    }, [])

    const handleVerify = async (kybId: string, userId: string) => {
        if (!confirm("Authorize this Merchant for Institutional Access?")) return
        
        setLoading(true)
        const { error } = await (supabase as any)
            .from("seller_kyb")
            .update({ is_verified: true })
            .eq("id", kybId)

        if (error) {
            alert("Protocol Authorization Failed: " + error.message)
        } else {
            setMerchants(merchants.map(m => m.id === kybId ? { ...m, is_verified: true } : m))
            alert("Merchant Protocol Successfully Authorized 🛡️")
        }
        setLoading(false)
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    return (
        <main className="bg-black min-h-screen text-white py-20 px-6 animate-fade-in pb-40">
            <div className="max-w-6xl mx-auto">
                 <header className="mb-16 border-b border-white/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <span className="text-[10px] uppercase tracking-[0.5em] text-primary font-bold">Admin Protocol • KYC Hub</span>
                        <h1 className="text-4xl lg:text-7xl mt-4 italic font-black uppercase tracking-tighter leading-tight">
                            Merchant <br/>Audit Terminal
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <Link href="/admin/test-rpc" className="luxury-button !bg-white/5 !border-white/10 !text-white/40 hover:!text-white !py-4 !px-8 font-black uppercase tracking-widest text-[9px]">
                            Test RPC Terminal
                        </Link>
                        <Link href="/admin/settlements" className="luxury-button !bg-white/5 !border-white/10 !text-white/40 hover:!text-white !py-4 !px-8 font-black uppercase tracking-widest text-[9px]">
                            Settlement Ledger →
                        </Link>
                    </div>
                 </header>

                 <div className="space-y-6">
                    {merchants.length === 0 ? (
                        <div className="text-center py-20 opacity-20 italic uppercase tracking-widest text-xs">No active enrollment records found.</div>
                    ) : (
                        merchants.map((m) => (
                            <div key={m.id} className="luxury-card bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-8 group hover:bg-white/[0.07] transition-all duration-500">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${m.is_verified ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
                                        <h3 className="text-xl font-black uppercase tracking-tight">{m.store_name}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">UPI Destination</p>
                                            <p className="text-sm font-mono tracking-widest text-primary">{m.upi_id}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">System Record ID</p>
                                            <p className="text-[10px] font-mono text-white/60">{m.id.slice(0, 15)}...</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 self-end md:self-center">
                                    {m.is_verified ? (
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-500 border border-green-500/20 px-6 py-3 rounded-full bg-green-500/5">
                                            Authorized Protocol ✓
                                        </span>
                                    ) : (
                                        <button 
                                            onClick={() => handleVerify(m.id, m.user_id)}
                                            className="luxury-button !bg-primary !text-black !py-4 !px-10 font-black shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]"
                                        >
                                            Authorize Merchant
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                 </div>
            </div>
        </main>
    )
}
