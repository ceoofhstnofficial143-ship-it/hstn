"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function DisputeHubTerminal() {
    const [disputes, setDisputes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDisputes = async () => {
             const { data, error } = await supabase
                .from("order_disputes")
                .select(`*`)
                .order("created_at", { ascending: false })
             
             if (error) {
                 console.error("Conflict Acquisition Failure:", error.message)
                 alert("Financial Protocol Error: " + error.message)
             }
             
             if (data) {
                console.log("Acquired Conflicts:", data.length)
                setDisputes(data)
             }
             setLoading(false)
        }
        fetchDisputes()
    }, [])

    const handleResolve = async (dispute: any, action: 'release' | 'refund') => {
        const msg = action === 'release' 
            ? "RELEASE FUNDS to Merchant? This concludes the audit in favor of the Seller."
            : "REFUND BUYER? This concludes the audit in favor of the Buyer. Payout will be cancelled."
            
        if (!confirm(msg)) return
        
        setLoading(true)
        
        // 🗡️ ATOMICS: Routed through Service Role Bridge (Authority Escalation)
        const res = await fetch("/api/admin/resolve-dispute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                dispute_id: dispute.id, 
                action: action 
            })
        })

        const resData = await res.json()
        if (!res.ok) {
            alert("Resolution Protocol Failure: " + (resData.error || "Internal Audit Error"))
        } else {
            setDisputes(disputes.map(d => d.id === dispute.id ? { ...d, status: action === 'release' ? 'released' : 'refunded' } : d))
            alert("Dispute Case Concluded ⚖️")
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
                        <span className="text-[10px] uppercase tracking-[0.5em] text-red-500 font-black">Conflict Audit • Internal Affairs</span>
                        <h1 className="text-4xl lg:text-7xl mt-4 italic font-black uppercase tracking-tighter leading-tight">
                            Dispute Hub
                        </h1>
                    </div>
                    <Link href="/admin/settlements" className="luxury-button !bg-white/5 !border-white/10 !text-white/40 hover:!text-white !py-4 !px-10 font-black uppercase tracking-widest text-[10px]">
                        Settlement Ledger →
                    </Link>
                 </header>

                 <div className="space-y-8">
                    {disputes.length === 0 ? (
                        <div className="text-center py-20 opacity-20 italic uppercase tracking-widest text-xs">No active conflicts detected in the archive.</div>
                    ) : (
                        disputes.map((d) => (
                            <div key={d.id} className={`luxury-card border p-8 rounded-[2.5rem] transition-all duration-500 bg-white/5 ${d.status === 'pending' ? 'border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.05)]' : 'border-white/5 opacity-60'}`}>
                                <div className="flex flex-col lg:flex-row justify-between gap-12">
                                    <div className="flex-1 space-y-6">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full ${d.status === 'pending' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white/50'}`}>
                                                {d.status} Protocol
                                            </span>
                                            <span className="text-[10px] font-mono text-white/40 uppercase">Case: {d.id.slice(0, 12)}</span>
                                        </div>

                                        <div>
                                            <h3 className="text-2xl font-black uppercase tracking-tighter italic mb-2">"{d.reason}"</h3>
                                            <p className="text-sm text-white/60 leading-relaxed font-medium">{d.details}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-6">
                                            <div>
                                                <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2">Claimant (Buyer)</p>
                                                <p className="text-xs font-black uppercase tracking-tight">{d.buyer?.full_name || 'Buyer ID'}</p>
                                                <p className="text-[10px] text-white/40 font-mono mt-1">{d.buyer?.email || d.buyer_id?.slice(0,12)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2">Merchant (Seller)</p>
                                                <p className="text-xs font-black uppercase tracking-tight">{d.seller?.full_name || 'Merchant ID'}</p>
                                                <p className="text-[10px] text-white/40 font-mono mt-1">{d.seller?.email || d.seller_id?.slice(0,12)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-72 space-y-4">
                                        <div className="bg-black p-6 rounded-2xl border border-white/5">
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-4">Escrow Value</p>
                                            <p className="text-3xl font-black text-primary italic">Reference Protocol</p>
                                            <p className="text-[10px] text-white/40 font-mono mt-1 uppercase">Order: {d.order_id?.slice(0, 12)}</p>
                                        </div>

                                        {d.status === 'pending' && (
                                            <div className="flex flex-col gap-3">
                                                <button 
                                                    onClick={() => handleResolve(d, 'release')}
                                                    className="luxury-button !bg-green-600 !text-white !py-4 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-green-600/10"
                                                >
                                                    Release Funds
                                                </button>
                                                <button 
                                                    onClick={() => handleResolve(d, 'refund')}
                                                    className="luxury-button !bg-white/5 !border-white/10 !text-red-500 hover:!bg-red-500 hover:!text-white !py-4 font-black uppercase tracking-widest text-[10px]"
                                                >
                                                    Refund Buyer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                 </div>
            </div>
        </main>
    )
}
