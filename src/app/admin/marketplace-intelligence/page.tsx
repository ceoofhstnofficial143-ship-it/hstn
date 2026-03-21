"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function MarketplaceIntelligence() {
    const [stats, setStats] = useState({ orders: 0, revenue: 0, events: 0, payouts: 0 })
    const [events, setEvents] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAdminData()
    }, [])

    const fetchAdminData = async () => {
        setLoading(true)
        
        // 1. Fetch Aggregates
        const { count: ordersCount } = await supabase.from("orders").select("*", { count: 'exact', head: true })
        const { count: eventsCount } = await supabase.from("system_events").select("*", { count: 'exact', head: true })
        const { count: payoutsCount } = await supabase.from("seller_payouts").select("*", { count: 'exact', head: true })
        
        const { data: revData } = await supabase.from("orders").select("total_price")
        const totalRevenue = revData?.reduce((acc, o) => acc + (o.total_price || 0), 0) || 0

        // 2. Fetch Recent Activities
        const { data: recentEvents } = await supabase.from("system_events").select("*").order("created_at", { ascending: false }).limit(10)
        const { data: recentOrders } = await supabase.from("orders").select("*, profiles!orders_seller_id_fkey(username)").order("created_at", { ascending: false }).limit(5)

        setStats({ orders: ordersCount || 0, revenue: totalRevenue, events: eventsCount || 0, payouts: payoutsCount || 0 })
        if (recentEvents) setEvents(recentEvents)
        if (recentOrders) setOrders(recentOrders)
        
        setLoading(false)
    }

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center p-20"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>

    return (
        <main className="min-h-screen bg-black text-white py-20 pb-40">
            <div className="section-container">
                <header className="mb-20 flex flex-col md:flex-row justify-between items-end gap-10">
                    <div>
                        <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">Institutional Control</span>
                        <h1 className="text-display mt-2 italic uppercase">Commercial Intelligence</h1>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/admin/reconciliation" className="luxury-button !py-4 !px-8 !bg-white/5 !text-white border-white/10">Truth Desk</Link>
                        <button onClick={fetchAdminData} className="luxury-button !py-4 !px-8 !bg-primary !text-black">Sync Ledger</button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-20">
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Gross Liquidity</p>
                        <p className="text-5xl font-black italic tracking-tighter">₹{stats.revenue.toLocaleString()}</p>
                    </div>
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Total Commands</p>
                        <p className="text-5xl font-black italic tracking-tighter">{stats.orders}</p>
                    </div>
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Payout Liabilities</p>
                        <p className="text-5xl font-black italic tracking-tighter">{stats.payouts}</p>
                    </div>
                    <div className="luxury-card p-10 bg-white/5 border-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">System Signals</p>
                        <p className="text-5xl font-black italic tracking-tighter">{stats.events}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* ORDER FLOW */}
                    <div className="lg:col-span-12">
                        <h2 className="text-xl font-black italic uppercase tracking-tighter mb-8">Recent Acquisition Flux</h2>
                        <div className="luxury-card overflow-hidden bg-white/5 border-none rounded-[2.5rem]">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 uppercase text-[9px] font-black tracking-widest text-white/40">
                                    <tr>
                                        <th className="px-8 py-6">ID</th>
                                        <th className="px-8 py-6">Vendor</th>
                                        <th className="px-8 py-6">Status</th>
                                        <th className="px-8 py-6 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-6 font-mono text-xs">{o.id.slice(0,8)}...</td>
                                            <td className="px-8 py-6 text-[10px] font-bold">@{o.profiles?.username || 'vendor'}</td>
                                            <td className="px-8 py-6">
                                                <span className="bg-primary/10 text-primary text-[8px] font-black uppercase px-2 py-1 rounded">{o.status}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right font-black italic">₹{o.total_price.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* EVENT LOG */}
                    <div className="lg:col-span-12">
                        <h2 className="text-xl font-black italic uppercase tracking-tighter mb-8">System Signals (Black Box)</h2>
                        <div className="luxury-card p-8 bg-white/5 border-none rounded-[2.5rem] space-y-4">
                            {events.map(e => (
                                <div key={e.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-2 h-2 rounded-full ${e.status === 'success' ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{e.event_type}</p>
                                            <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">Source: {e.source} | Ref: {e.reference_id}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 sm:mt-0 text-right">
                                        <p className="text-[9px] text-white/20 font-mono italic">{new Date(e.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
