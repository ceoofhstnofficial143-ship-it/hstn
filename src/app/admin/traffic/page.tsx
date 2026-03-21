"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import Image from "next/image"

export default function TrafficCommandCenter() {
    const [stats, setStats] = useState({ totalViews: 0, uniqueAssets: 0, latestViews: [] as any[] })
    const [trending, setTrending] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTrafficData = async () => {
            // 1. Fetch Latest Impressions
            const { data: latest } = await supabase
                .from("product_views")
                .select(`
                    *,
                    products (title, image_url, price)
                `)
                .order("created_at", { ascending: false })
                .limit(10)

            // 2. Fetch Aggregated Traffic (Mocking real-time aggregation for UI demo)
            const { count: total } = await supabase
                .from("product_views")
                .select("*", { count: 'exact', head: true })

            // 3. Fetch Trending Assets (Most viewed)
            // Note: In production, we would use a more complex GROUP BY RPC
            const { data: trend } = await supabase
                .from("products")
                .select("*")
                .order("views", { ascending: false })
                .limit(5)

            if (latest) setStats(prev => ({ ...prev, latestViews: latest, totalViews: total || 0 }))
            if (trend) setTrending(trend)
            setLoading(false)
        }

        fetchTrafficData()
        
        // Subscription Protocol for Real-time Updates
        const channel = supabase
            .channel('traffic-intelligence')
            .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'product_views' }, () => {
                fetchTrafficData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    return (
        <main className="bg-black min-h-screen text-white py-20 pb-40">
            <div className="section-container">
                <header className="mb-20 flex flex-col md:flex-row justify-between items-end gap-10">
                    <div>
                        <span className="text-caption uppercase tracking-[0.4em] text-primary font-black animate-pulse">Live Protocol Active</span>
                        <h1 className="text-display mt-2 italic uppercase tracking-tighter">Traffic Command Center</h1>
                        <p className="text-body text-white/50 mt-4 max-w-xl">
                            Real-time synchronization with global institutional impressions.
                        </p>
                    </div>
                    <div className="flex gap-8">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-black tracking-widest text-white/40">Total Lifetime Hits</span>
                            <span className="text-5xl font-black italic text-primary">{stats.totalViews.toLocaleString()}</span>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* LEFT: Live Stream */}
                    <div className="lg:col-span-12 xl:col-span-8 space-y-12">
                        <div className="flex items-center gap-6 mb-8">
                            <h2 className="text-h2 italic uppercase tracking-tighter">Engagement Stream</h2>
                            <div className="h-px bg-white/10 flex-1" />
                        </div>

                        <div className="space-y-4">
                            {stats.latestViews.map((view, idx) => (
                                <div key={idx} className="luxury-card p-6 bg-white/5 border-none flex items-center justify-between group hover:bg-white/10 transition-all duration-700">
                                    <div className="flex items-center gap-8">
                                        <div className="w-16 h-20 bg-white/5 rounded-xl overflow-hidden relative border border-white/10">
                                            <Image src={view.products?.image_url} alt="asset" fill className="object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-tight">{view.products?.title}</p>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
                                                ID: {view.id.slice(0, 8)} • Captured {new Date(view.created_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] bg-primary text-black px-3 py-1 rounded font-black uppercase italic">Impression</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Trends */}
                    <div className="lg:col-span-12 xl:col-span-4 space-y-12">
                        <div className="flex items-center gap-6 mb-8">
                            <h2 className="text-h2 italic uppercase tracking-tighter">Market Trends</h2>
                        </div>

                        <div className="space-y-8">
                            {trending.map((asset, idx) => (
                                <div key={idx} className="flex items-center gap-6 group">
                                    <span className="text-4xl font-black italic text-white/10 group-hover:text-primary transition-colors">0{idx + 1}</span>
                                    <div className="flex-1">
                                        <p className="text-xs font-black uppercase tracking-tight group-hover:text-primary transition-colors">{asset.title}</p>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                                            <div 
                                                className="h-full bg-primary transition-all duration-1000" 
                                                style={{ width: `${Math.min(100, (asset.views / 500) * 100)}%` }} 
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black italic">{asset.views.toLocaleString()} Hits</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-20 p-10 bg-primary rounded-[2.5rem] text-black">
                            <h3 className="text-h3 font-black uppercase tracking-tight italic">Protocol Alert</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest mt-4 leading-relaxed">
                                Market activity in "Streetwear" sector is 40% above baseline metrics today. Recommend inventory escalation.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
