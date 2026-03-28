"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function SellerPayouts() {
    const [payouts, setPayouts] = useState<any[]>([])
    const [stats, setStats] = useState({ total_earned: 0, pending: 0, processed: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPayoutData()
    }, [])

    const fetchPayoutData = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // 1. Fetch Payouts for this Seller
        const { data } = await (supabase as any).from("seller_payouts").select("*, orders(status, created_at)").eq("seller_id", user.id).order("created_at", { ascending: false })
        
        if (data) {
            setPayouts(data)
            const earned = data.reduce((acc: number, p: any) => acc + (p.amount || 0), 0)
            const pend = data.filter((p: any) => p.status === 'pending').reduce((acc: number, p: any) => acc + (p.amount || 0), 0)
            const proc = data.filter((p: any) => p.status === 'processed').reduce((acc: number, p: any) => acc + (p.amount || 0), 0)
            setStats({ total_earned: earned, pending: pend, processed: proc })
        }
        setLoading(false)
    }

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

    return (
        <main className="min-h-screen bg-black text-white py-20 pb-40">
            <div className="section-container">
                <header className="mb-20 flex flex-col md:flex-row justify-between items-end gap-10">
                    <div>
                        <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">Merchant Treasury</span>
                        <h1 className="text-display mt-2 italic uppercase">Settlement Ledger</h1>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Institutional Balance</span>
                        <p className="text-4xl font-black italic tracking-tighter">₹{stats.total_earned.toLocaleString()}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Pending Entitlement</p>
                        <p className="text-5xl font-black italic tracking-tighter">₹{stats.pending.toLocaleString()}</p>
                    </div>
                    <div className="luxury-card p-10 bg-primary/10 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Processed Liquid Capital</p>
                        <p className="text-5xl font-black italic tracking-tighter text-primary">₹{stats.processed.toLocaleString()}</p>
                    </div>
                </div>

                <div className="luxury-card overflow-hidden bg-white/5 border-none rounded-[2.5rem]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 uppercase text-[9px] font-black tracking-widest text-white/40">
                                <tr>
                                    <th className="px-8 py-6">Reference</th>
                                    <th className="px-8 py-6">Order ID</th>
                                    <th className="px-8 py-6">Status</th>
                                    <th className="px-8 py-6 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.map(p => (
                                    <tr key={p.id} className="border-b border-white/5 last:border-none group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-6 text-[10px] font-bold font-mono">
                                            {p.settlement_ref || 'HSTNLX_HOLD_PROTOCOL'}
                                        </td>
                                        <td className="px-8 py-6 font-mono text-[10px] text-white/40">
                                            {p.order_id.slice(0, 8)}...
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${
                                                p.is_disputed ? 'bg-red-500/10 text-red-500 animate-pulse' :
                                                p.status === 'processed' ? 'bg-green-500/10 text-green-500' : 
                                                'bg-primary/10 text-primary'
                                            }`}>
                                                {p.is_disputed ? 'CONFLICT ⚔️' : p.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right font-black italic text-lg">
                                            ₹{p.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    )
}
