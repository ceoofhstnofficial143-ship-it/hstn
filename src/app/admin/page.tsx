"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        users: 0,
        products: 0,
        pendingProducts: 0,
        orders: 0,
        revenue: 0
    })
    const [topSellers, setTopSellers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        setLoading(true)
        
        // 1. User Count
        const { count: userCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })

        // 2. Product Counts
        const { count: productCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })

        const { count: pendingCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("admin_status", "pending")

        // 3. Order Stats
        const { count: orderCount } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })

        const { data: deliveredOrders } = await supabase
            .from("orders")
            .select("total_price")
            .eq("status", "delivered")

        const revenue = deliveredOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0

        setStats({
            users: userCount || 0,
            products: productCount || 0,
            pendingProducts: pendingCount || 0,
            orders: orderCount || 0,
            revenue
        })

        // 4. Top Sellers
        const { data: topSellersData } = await supabase
            .from("orders")
            .select(`
                seller_id,
                total_price,
                profiles:seller_id(username)
            `)
            .eq("status", "delivered")

        if (topSellersData) {
            const sellerMap: any = {}
            topSellersData.forEach((order: any) => {
                const sId = order.seller_id
                const price = order.total_price || 0
                const username = order.profiles?.username || 'Unknown'

                if (!sellerMap[sId]) {
                    sellerMap[sId] = { username, revenue: 0 }
                }
                sellerMap[sId].revenue += price
            })

            const sorted = Object.values(sellerMap)
                .sort((a: any, b: any) => b.revenue - a.revenue)
                .slice(0, 5)
            setTopSellers(sorted)
        }

        setLoading(false)
    }

    if (loading) {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                 {[1,2,3,4].map(i => (
                     <div key={i} className="h-32 bg-slate-100 rounded-[32px]"></div>
                 ))}
             </div>
        )
    }

    return (
        <div className="space-y-12">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Marketplace <span className="text-slate-400">Overview</span></h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Real-time system health and liquidity metrics</p>
                </div>
                <Link href="/admin/marketplace-intelligence" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-6 py-3 rounded-2xl hover:bg-slate-900 hover:text-white transition-all">
                    Deep Intelligence →
                </Link>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Revenue</p>
                    <p className="text-3xl font-black">₹ {stats.revenue.toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Users</p>
                    <p className="text-3xl font-black">{stats.users.toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Active Products</p>
                    <p className="text-3xl font-black">{stats.products.toLocaleString()}</p>
                </div>
                <Link href="/admin/products" className="bg-orange-50 p-8 rounded-[32px] border border-orange-100 shadow-sm hover:bg-orange-100 transition-all group">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Pending Review</p>
                    <div className="flex items-center justify-between">
                         <p className="text-3xl font-black text-orange-950">{stats.pendingProducts}</p>
                         <span className="text-orange-400 group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Visual Graph Placeholder or something? Let's just do Top Sellers */}
                <div className="lg:col-span-2 bg-white rounded-[40px] p-10 border border-slate-100">
                    <h2 className="text-2xl font-black mb-8">System Traffic</h2>
                    <div className="aspect-[21/9] bg-slate-50 rounded-3xl flex items-center justify-center border border-dashed border-slate-200">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Advanced Telemetry Visualizer Reserved</p>
                    </div>
                </div>

                <div className="bg-white rounded-[40px] p-10 border border-slate-100">
                    <h2 className="text-xl font-black mb-6 uppercase tracking-widest text-[11px] text-slate-400">Top Acquisition Partners</h2>
                    <div className="space-y-4">
                        {topSellers.map((seller, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div>
                                    <p className="text-xs font-black">@{seller.username}</p>
                                    <p className="text-[9px] text-slate-400 uppercase font-black mt-0.5">Yield: ₹ {seller.revenue.toLocaleString()}</p>
                                </div>
                                <div className="text-[10px] font-black px-2 py-1 bg-white rounded-md border border-slate-100 shadow-sm">
                                    RANK #{i+1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
