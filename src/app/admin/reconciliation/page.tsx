"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function ReconciliationDashboard() {
    const [audit, setAudit] = useState<any[]>([])
    const [stats, setStats] = useState({ captured: 0, orders: 0, liability: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAuditData()
    }, [])

    const fetchAuditData = async () => {
        setLoading(true)
        
        // 1. Fetch from the View (Unified Truth)
        const { data: vw } = await (supabase as any).from("vw_reconciliation_audit").select("*")
        
        // 2. Aggregate Stats
        const { data: payments } = await (supabase as any).from("payments").select("amount").eq("status", "captured")
        const { count: orders } = await (supabase as any).from("orders").select("*", { count: 'exact', head: true })
        const { data: payouts } = await (supabase as any).from("seller_payouts").select("amount").in("status", ["pending", "eligible"])

        const totalCaptured = payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0
        const totalLiability = payouts?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0

        if (vw) setAudit(vw)
        setStats({ captured: totalCaptured, orders: orders || 0, liability: totalLiability })
        setLoading(false)
    }

    const mismatchCount = audit.filter(a => a.audit_result !== 'SYNCHRONIZED').length

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

    return (
        <main className="min-h-screen bg-black text-white py-20 pb-40">
            <div className="section-container">
                <header className="mb-16 flex flex-col md:flex-row justify-between items-end gap-10">
                    <div>
                        <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">Authority Oversight</span>
                        <h1 className="text-display mt-2 italic uppercase">Financial Reconciliation</h1>
                    </div>
                    {mismatchCount > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-2xl flex items-center gap-4 animate-pulse">
                            <span className="w-3 h-3 bg-red-500 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                                CRITICAL: {mismatchCount} Synchronicity Breaches
                            </span>
                        </div>
                    )}
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Captured Capital (Gross)</p>
                        <p className="text-5xl font-black italic tracking-tighter">₹{stats.captured.toLocaleString()}</p>
                    </div>
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Managed Orders</p>
                        <p className="text-5xl font-black italic tracking-tighter">{stats.orders}</p>
                    </div>
                    <div className="luxury-card p-10 bg-primary/10 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Projected Liability (Sellers)</p>
                        <p className="text-5xl font-black italic tracking-tighter text-primary">₹{stats.liability.toLocaleString()}</p>
                    </div>
                </div>

                <div className="luxury-card overflow-hidden bg-white/5 border-none rounded-[2.5rem]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 uppercase text-[9px] font-black tracking-widest text-white/40">
                                    <th className="px-8 py-6">Payment ID</th>
                                    <th className="px-8 py-6">Result</th>
                                    <th className="px-8 py-6">Order ID</th>
                                    <th className="px-8 py-6 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {audit.map((row, idx) => (
                                    <tr key={idx} className="border-b border-white/5 last:border-none group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-6">
                                            <p className="text-xs font-bold font-mono">{row.payment_id}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded text-[8px] font-black uppercase italic ${
                                                row.audit_result === 'SYNCHRONIZED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500 text-white'
                                            }`}>
                                                {row.audit_result}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-xs text-white/60 font-mono">
                                            {row.order_id || '--- RECOVERY NEEDED ---'}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{row.order_status || 'MISSING'}</span>
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
