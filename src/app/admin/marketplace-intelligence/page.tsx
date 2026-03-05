"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface OrderWithProduct {
    id: string;
    product_id: string;
    status: string;
    products: { price: number } | null;
}

interface FunnelAnalytics {
    date_bucket: string
    feed_views: number
    product_clicks: number
    cart_adds: number
    checkout_starts: number
    checkout_completes: number
    ctr: number
    cart_rate: number
    checkout_start_rate: number
    completion_rate: number
}

interface GlobalMetrics {
    total_sellers: number
    total_products: number
    total_orders: number
    total_revenue: number
    avg_trust_score: number
    elite_sellers: number
    gold_sellers: number
    verified_sellers: number
}

export default function MarketplaceIntelligence() {
    const [funnelData, setFunnelData] = useState<FunnelAnalytics[]>([])
    const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('7d')

    useEffect(() => {
        fetchMarketplaceData()
    }, [timeframe])

    const fetchMarketplaceData = async () => {
        setLoading(true)
        
        // Get funnel analytics
        const daysAgo = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
        const { data: funnelData } = await supabase
            .from('funnel_analytics')
            .select('*')
            .gte('date_bucket', new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date_bucket', { ascending: false })
            .limit(30)

        // Calculate global metrics
        const { data: sellersData } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('role', 'seller')

        const { data: productsData } = await supabase
            .from('products')
            .select('id, user_id, price')

        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
                id,
                product_id,
                status,
                products (price)
            `) as { data: OrderWithProduct[] | null }

        const { data: trustData } = await supabase
            .from('trust_scores')
            .select('score')

        // Calculate metrics
        const totalSellers = sellersData?.length || 0
        const totalProducts = productsData?.length || 0
        const totalOrders = ordersData?.filter(o => o.status === 'delivered').length || 0
        const totalRevenue = ordersData?.reduce((acc: number, order: OrderWithProduct) => {
            return acc + (order.products?.price || 0)
        }, 0) || 0
        const avgTrustScore = (trustData as any)?.reduce((acc: number, t: any) => acc + (t.score || 0), 0) / (trustData?.length || 1) || 0

        const eliteSellers = trustData?.filter(t => t.score >= 150).length || 0
        const goldSellers = trustData?.filter(t => t.score >= 100 && t.score < 150).length || 0
        const verifiedSellers = trustData?.filter(t => t.score >= 50 && t.score < 100).length || 0

        setGlobalMetrics({
            total_sellers: totalSellers,
            total_products: totalProducts,
            total_orders: totalOrders,
            total_revenue: totalRevenue,
            avg_trust_score: Math.round(avgTrustScore),
            elite_sellers: eliteSellers,
            gold_sellers: goldSellers,
            verified_sellers: verifiedSellers
        })

        setFunnelData(funnelData || [])
        setLoading(false)
    }

    const refreshAnalytics = async () => {
        await supabase.rpc('refresh_all_analytics')
        await fetchMarketplaceData()
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <main className="bg-background min-h-screen animate-fade-in py-20">
            <div className="section-container">
                <header className="mb-12 flex justify-between items-start">
                    <div>
                        <span className="text-caption uppercase tracking-widest text-primary font-bold">Admin Console</span>
                        <h1 className="text-display mt-2 italic">Marketplace Intelligence</h1>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex gap-2">
                            {(['7d', '30d', '90d'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setTimeframe(period)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                        timeframe === period
                                            ? 'bg-primary text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={refreshAnalytics}
                            className="luxury-button !text-xs !py-3 !px-6"
                        >
                            Refresh Data
                        </button>
                    </div>
                </header>

                {/* Global Metrics */}
                {globalMetrics && (
                    <div className="mb-12">
                        <h2 className="text-h3 font-bold mb-6 uppercase tracking-widest">Global Marketplace Health</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                                <div className="text-3xl font-black text-primary">
                                    {globalMetrics.total_sellers}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Total Sellers
                                </div>
                            </div>
                            
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                                <div className="text-3xl font-black text-green-600">
                                    {globalMetrics.total_products}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Active Products
                                </div>
                            </div>

                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                                <div className="text-3xl font-black text-blue-600">
                                    {globalMetrics.total_orders}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Completed Orders
                                </div>
                            </div>

                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                                <div className="text-3xl font-black text-purple-600">
                                    ₹{globalMetrics.total_revenue.toLocaleString()}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Total Revenue
                                </div>
                            </div>
                        </div>

                        {/* Trust Tier Distribution */}
                        <div className="mt-8 bg-gradient-to-r from-primary/10 to-purple-10 rounded-2xl p-8">
                            <h3 className="text-h3 font-bold mb-6">Trust Tier Distribution</h3>
                            <div className="grid md:grid-cols-4 gap-6">
                                <div className="text-center">
                                    <div className="text-2xl font-black text-gray-600">
                                        {globalMetrics.total_sellers - globalMetrics.verified_sellers - globalMetrics.gold_sellers - globalMetrics.elite_sellers}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        Unverified
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-black text-green-600">
                                        {globalMetrics.verified_sellers}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        🟢 Verified
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-black text-yellow-600">
                                        {globalMetrics.gold_sellers}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        🟡 Gold
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-black text-blue-600">
                                        {globalMetrics.elite_sellers}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        🔵 Elite
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 text-center">
                                <div className="text-lg font-black text-primary">
                                    {globalMetrics.avg_trust_score}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Average Trust Score
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Funnel Analytics */}
                {funnelData.length > 0 && (
                    <div>
                        <h2 className="text-h3 font-bold mb-6 uppercase tracking-widest">Conversion Funnel</h2>
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8">
                            <div className="grid md:grid-cols-5 gap-6 mb-8">
                                <div className="text-center">
                                    <div className="text-2xl font-black text-primary">
                                        {funnelData.reduce((acc, f) => acc + f.feed_views, 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        Feed Views
                                    </div>
                                </div>
                                
                                <div className="text-center">
                                    <div className="text-2xl font-black text-blue-600">
                                        {funnelData.reduce((acc, f) => acc + f.product_clicks, 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        Product Clicks
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-2xl font-black text-orange-600">
                                        {funnelData.reduce((acc, f) => acc + f.cart_adds, 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        Cart Adds
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-2xl font-black text-purple-600">
                                        {funnelData.reduce((acc, f) => acc + f.checkout_starts, 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        Checkout Starts
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-2xl font-black text-green-600">
                                        {funnelData.reduce((acc, f) => acc + f.checkout_completes, 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                        Orders
                                    </div>
                                </div>
                            </div>

                            {/* Conversion Rates */}
                            <div className="border-t border-gray-200 pt-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Average Conversion Rates</h3>
                                <div className="grid md:grid-cols-4 gap-6">
                                    <div className="text-center">
                                        <div className="text-xl font-black text-blue-600">
                                            {(funnelData.reduce((acc, f) => acc + f.ctr, 0) / funnelData.length).toFixed(1)}%
                                        </div>
                                        <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                            Click-Through Rate
                                        </div>
                                    </div>
                                    
                                    <div className="text-center">
                                        <div className="text-xl font-black text-orange-600">
                                            {(funnelData.reduce((acc, f) => acc + f.cart_rate, 0) / funnelData.length).toFixed(1)}%
                                        </div>
                                        <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                            Cart Rate
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-xl font-black text-purple-600">
                                            {(funnelData.reduce((acc, f) => acc + f.checkout_start_rate, 0) / funnelData.length).toFixed(1)}%
                                        </div>
                                        <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                            Checkout Start Rate
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-xl font-black text-green-600">
                                            {(funnelData.reduce((acc, f) => acc + f.completion_rate, 0) / funnelData.length).toFixed(1)}%
                                        </div>
                                        <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                            Completion Rate
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recent Daily Performance */}
                {funnelData.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-h3 font-bold mb-6 uppercase tracking-widest">Recent Daily Performance</h2>
                        <div className="space-y-4">
                            {funnelData.slice(0, 7).map((day, index) => (
                                <div key={day.date_bucket} className="bg-white/50 backdrop-blur-sm rounded-xl p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="font-bold text-sm">
                                            {new Date(day.date_bucket).toLocaleDateString('en-US', { 
                                                weekday: 'short', 
                                                month: 'short', 
                                                day: 'numeric' 
                                            })}
                                        </div>
                                        <div className="flex gap-4 text-xs">
                                            <span className="font-bold text-blue-600">
                                                CTR: {day.ctr.toFixed(1)}%
                                            </span>
                                            <span className="font-bold text-green-600">
                                                Completion: {day.completion_rate.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-5 gap-4 text-center text-xs">
                                        <div>
                                            <div className="font-black text-primary">{day.feed_views}</div>
                                            <div className="text-gray-600">Views</div>
                                        </div>
                                        <div>
                                            <div className="font-black text-blue-600">{day.product_clicks}</div>
                                            <div className="text-gray-600">Clicks</div>
                                        </div>
                                        <div>
                                            <div className="font-black text-orange-600">{day.cart_adds}</div>
                                            <div className="text-gray-600">Cart</div>
                                        </div>
                                        <div>
                                            <div className="font-black text-purple-600">{day.checkout_starts}</div>
                                            <div className="text-gray-600">Checkout</div>
                                        </div>
                                        <div>
                                            <div className="font-black text-green-600">{day.checkout_completes}</div>
                                            <div className="text-gray-600">Orders</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
