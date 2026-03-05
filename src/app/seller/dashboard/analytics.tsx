"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface SellerAnalytics {
    total_impressions: number
    unique_viewers: number
    total_video_plays: number
    total_wishlist_adds: number
    total_cart_adds: number
    total_orders: number
    total_quests_completed: number
    first_activity: string
    last_activity: string
    total_views?: number // Adding this for compatibility
}

interface ProductAnalytics {
    product_id: string
    heat_score: number
    total_views: number
    total_video_plays: number
    total_wishlist_adds: number
    total_cart_adds: number
    total_orders: number
    conversion_rate: number
}

export default function SellerAnalyticsPanel({ userId }: { userId: string }) {
    const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null)
    const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics[]>([])
    const [loading, setLoading] = useState(true)
    const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('7d')

    useEffect(() => {
        fetchAnalytics()
    }, [userId, timeframe])

    const fetchAnalytics = async () => {
        setLoading(true)
        
        // Get seller analytics
        const { data: sellerData } = await supabase
            .from('seller_analytics')
            .select('*')
            .eq('seller_id', userId)
            .single()

        // Get product analytics for seller's products
        const { data: productsData } = await supabase
            .from('products')
            .select('id')
            .eq('user_id', userId)

        if (productsData && productsData.length > 0) {
            const productIds = productsData.map(p => p.id)
            
            const { data: productAnalyticsData } = await supabase
                .from('product_analytics')
                .select('*')
                .in('product_id', productIds)
                .order('heat_score', { ascending: false })
                .limit(10)

            setProductAnalytics(productAnalyticsData || [])
        }

        setAnalytics(sellerData)
        setLoading(false)
    }

    const calculateCTR = () => {
        if (!analytics || analytics.total_impressions === 0) return 0
        return ((analytics.total_cart_adds / analytics.total_impressions) * 100).toFixed(1)
    }

    const calculateVideoEngagement = () => {
        if (!analytics || (analytics.total_views ?? 0) === 0) return 0
        return ((analytics.total_video_plays / (analytics.total_views ?? 0)) * 100).toFixed(1)
    }

    if (loading) {
        return (
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Performance Metrics */}
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-h3 font-bold">Performance Metrics</h3>
                    <div className="flex gap-2">
                        {(['7d', '30d', 'all'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setTimeframe(period)}
                                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                    timeframe === period
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'All Time'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* PRIMARY METRIC 1: Views */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 text-center border border-primary/20">
                        <div className="text-4xl font-black text-primary mb-2">
                            {analytics?.total_impressions.toLocaleString() || 0}
                        </div>
                        <div className="text-sm uppercase tracking-widest text-gray-700 font-bold">
                            Product Views
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            Last 7 days performance
                        </div>
                    </div>
                    
                    {/* PRIMARY METRIC 2: Add-to-Cart % */}
                    <div className="bg-gradient-to-br from-green-10 to-green-5 rounded-2xl p-8 text-center border border-green-200">
                        <div className="text-4xl font-black text-green-600 mb-2">
                            {calculateCTR()}%
                        </div>
                        <div className="text-sm uppercase tracking-widest text-gray-700 font-bold">
                            Cart Rate
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            Views → Cart conversion
                        </div>
                    </div>

                    {/* PRIMARY METRIC 3: HTP Gained */}
                    <div className="bg-gradient-to-br from-orange-10 to-orange-5 rounded-2xl p-8 text-center border border-orange-200">
                        <div className="text-4xl font-black text-orange-600 mb-2">
                            +{(analytics?.total_quests_completed ?? 0) * 8}
                        </div>
                        <div className="text-sm uppercase tracking-widest text-gray-700 font-bold">
                            HTP This Week
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            From quest completion
                        </div>
                    </div>
                </div>

                {/* ADVANCED METRICS - Collapsible */}
                <details className="group">
                    <summary className="cursor-pointer flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <span className="text-sm font-bold uppercase tracking-widest text-gray-700">
                            📊 Advanced Analytics
                        </span>
                        <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform">
                            ▼
                        </span>
                    </summary>
                    
                    <div className="mt-4 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-black text-blue-600">
                                    {analytics?.unique_viewers.toLocaleString() || 0}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Unique Viewers
                                </div>
                            </div>

                            <div className="text-center">
                                <div className="text-2xl font-black text-purple-600">
                                    {calculateVideoEngagement()}%
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Video Engagement
                                </div>
                            </div>

                            <div className="text-center">
                                <div className="text-2xl font-black text-orange-600">
                                    {analytics?.total_wishlist_adds.toLocaleString() || 0}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Wishlist Saves
                                </div>
                            </div>

                            <div className="text-center">
                                <div className="text-2xl font-black text-green-600">
                                    {analytics?.total_orders.toLocaleString() || 0}
                                </div>
                                <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                    Orders
                                </div>
                            </div>
                        </div>

                        {/* Product Heat Scores */}
                        {productAnalytics.length > 0 && (
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8">
                                <h3 className="text-h3 font-bold mb-6">Product Heat Scores</h3>
                                <div className="space-y-4">
                                    {productAnalytics.slice(0, 5).map((product, index) => (
                                        <div key={product.product_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-black">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm">Product #{product.product_id.slice(0, 8)}</div>
                                                    <div className="text-xs text-gray-600">
                                                        {product.total_views} views • {product.total_video_plays} video plays
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-orange-600">
                                                    {product.heat_score}
                                                </div>
                                                <div className="text-xs text-gray-600">Heat Score</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Engagement Insights */}
                        <div className="bg-gradient-to-r from-primary/10 to-purple-10 rounded-2xl p-8">
                            <h3 className="text-h3 font-bold mb-4">🔥 Engagement Insights</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-widest mb-3">Video Performance</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Total Video Plays:</span>
                                            <span className="font-bold">{analytics?.total_video_plays || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Engagement Rate:</span>
                                            <span className="font-bold text-purple-600">{calculateVideoEngagement()}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-widest mb-3">Conversion Funnel</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Views → Cart:</span>
                                            <span className="font-bold text-blue-600">{calculateCTR()}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Cart → Orders:</span>
                                            <span className="font-bold text-green-600">
                                                {analytics && analytics.total_cart_adds > 0 
                                                    ? ((analytics.total_orders / analytics.total_cart_adds) * 100).toFixed(1)
                                                    : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    )
}
