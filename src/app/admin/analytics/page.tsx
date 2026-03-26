"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface EventStats {
  totalViews: number
  totalCarts: number
  totalWishlists: number
  totalSearches: number
  conversionRate: number
  wishlistRate: number
}

interface TopProduct {
  product_id: string
  title: string
  views: number
  carts: number
  wishlist: number
}

interface DailyStats {
  date: string
  views: number
  carts: number
  searches: number
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<EventStats>({
    totalViews: 0,
    totalCarts: 0,
    totalWishlists: 0,
    totalSearches: 0,
    conversionRate: 0,
    wishlistRate: 0
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single() as { data: { is_admin: boolean } | null }

    if (!profile?.is_admin) {
      router.push('/')
      return
    }

    setIsAdmin(true)
    fetchAnalytics()
  }

  const fetchAnalytics = async () => {
    setLoading(true)

    // Total event counts
    const { data: events } = await supabase
      .from('marketplace_events')
      .select('event_type') as { data: { event_type: string }[] | null }

    if (events) {
      const totalViews = events.filter(e => e.event_type === 'product_view').length
      const totalCarts = events.filter(e => e.event_type === 'add_to_cart').length
      const totalWishlists = events.filter(e => e.event_type === 'wishlist_add').length
      const totalSearches = events.filter(e => e.event_type === 'search').length

      setStats({
        totalViews,
        totalCarts,
        totalWishlists,
        totalSearches,
        conversionRate: totalViews > 0 ? ((totalCarts / totalViews) * 100).toFixed(1) as any : 0,
        wishlistRate: totalViews > 0 ? ((totalWishlists / totalViews) * 100).toFixed(1) as any : 0
      })
    }

    // Top products by views
    const { data: viewData } = await supabase
      .from('marketplace_events')
      .select('metadata')
      .eq('event_type', 'product_view') as { data: { metadata: { product_id?: string } | null }[] | null }

    if (viewData) {
      const productViews: Record<string, number> = {}
      viewData.forEach(e => {
        const productId = e.metadata?.product_id
        if (productId) {
          productViews[productId] = (productViews[productId] || 0) + 1
        }
      })

      const topProductIds = Object.entries(productViews)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id)

      if (topProductIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, title')
          .in('id', topProductIds) as { data: { id: string, title: string }[] | null }

        const { data: cartData } = await supabase
          .from('marketplace_events')
          .select('metadata')
          .eq('event_type', 'add_to_cart') as { data: { metadata: { product_id?: string } | null }[] | null }

        const { data: wishlistData } = await supabase
          .from('marketplace_events')
          .select('metadata')
          .eq('event_type', 'wishlist_add') as { data: { metadata: { product_id?: string } | null }[] | null }

        const cartCounts: Record<string, number> = {}
        cartData?.forEach(e => {
          const productId = e.metadata?.product_id
          if (productId) cartCounts[productId] = (cartCounts[productId] || 0) + 1
        })

        const wishlistCounts: Record<string, number> = {}
        wishlistData?.forEach(e => {
          const productId = e.metadata?.product_id
          if (productId) wishlistCounts[productId] = (wishlistCounts[productId] || 0) + 1
        })

        const topProductsData: TopProduct[] = topProductIds.map(id => {
          const product = products?.find(p => p.id === id)
          return {
            product_id: id,
            title: product?.title || 'Unknown',
            views: productViews[id] || 0,
            carts: cartCounts[id] || 0,
            wishlist: wishlistCounts[id] || 0
          }
        })

        setTopProducts(topProductsData)
      }
    }

    // Daily stats (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentEvents } = await supabase
      .from('marketplace_events')
      .select('event_type, created_at')
      .gte('created_at', sevenDaysAgo.toISOString()) as { data: { event_type: string, created_at: string }[] | null }

    if (recentEvents) {
      const dailyMap: Record<string, DailyStats> = {}
      
      recentEvents.forEach(e => {
        const date = new Date(e.created_at).toISOString().split('T')[0]
        if (!dailyMap[date]) {
          dailyMap[date] = { date, views: 0, carts: 0, searches: 0 }
        }
        
        if (e.event_type === 'product_view') dailyMap[date].views++
        if (e.event_type === 'add_to_cart') dailyMap[date].carts++
        if (e.event_type === 'search') dailyMap[date].searches++
      })

      setDailyStats(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)))
    }

    setLoading(false)
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500">System Intelligence</span>
            <h1 className="text-4xl font-black uppercase tracking-tighter mt-2">Analytics Dashboard</h1>
          </div>
          <button 
            onClick={fetchAnalytics}
            className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh Data
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-12">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <span className="text-[9px] uppercase tracking-widest text-gray-500">Total Views</span>
                <p className="text-3xl font-black mt-2">{stats.totalViews.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <span className="text-[9px] uppercase tracking-widest text-gray-500">Add to Cart</span>
                <p className="text-3xl font-black mt-2">{stats.totalCarts.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <span className="text-[9px] uppercase tracking-widest text-gray-500">Wishlists</span>
                <p className="text-3xl font-black mt-2">{stats.totalWishlists.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <span className="text-[9px] uppercase tracking-widest text-gray-500">Searches</span>
                <p className="text-3xl font-black mt-2">{stats.totalSearches.toLocaleString()}</p>
              </div>
            </div>

            {/* Conversion Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-900/50 to-green-950 rounded-2xl p-8 border border-green-800">
                <span className="text-[9px] uppercase tracking-widest text-green-400">View → Cart Rate</span>
                <p className="text-5xl font-black mt-4">{stats.conversionRate}%</p>
                <p className="text-xs text-gray-400 mt-2">Industry avg: 2-3%</p>
              </div>
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-950 rounded-2xl p-8 border border-purple-800">
                <span className="text-[9px] uppercase tracking-widest text-purple-400">View → Wishlist Rate</span>
                <p className="text-5xl font-black mt-4">{stats.wishlistRate}%</p>
                <p className="text-xs text-gray-400 mt-2">Engagement indicator</p>
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
              <h2 className="text-xl font-black uppercase tracking-widest mb-6">Top Performing Products</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-widest text-gray-500 border-b border-gray-800">
                      <th className="pb-4">Product</th>
                      <th className="pb-4">Views</th>
                      <th className="pb-4">Carts</th>
                      <th className="pb-4">Wishlists</th>
                      <th className="pb-4">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((product, idx) => (
                      <tr key={product.product_id} className="border-b border-gray-800/50">
                        <td className="py-4">
                          <span className="text-xs font-bold">{idx + 1}.</span>
                          <span className="ml-2 text-sm">{product.title}</span>
                        </td>
                        <td className="py-4 text-sm">{product.views.toLocaleString()}</td>
                        <td className="py-4 text-sm">{product.carts}</td>
                        <td className="py-4 text-sm">{product.wishlist}</td>
                        <td className="py-4 text-sm text-green-400">
                          {product.views > 0 ? ((product.carts / product.views) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Trend */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
              <h2 className="text-xl font-black uppercase tracking-widest mb-6">7-Day Activity Trend</h2>
              <div className="space-y-4">
                {dailyStats.map(day => (
                  <div key={day.date} className="flex items-center gap-6">
                    <span className="text-xs text-gray-500 w-24">{day.date}</span>
                    <div className="flex-1 flex gap-2">
                      <div 
                        className="h-6 bg-blue-500 rounded" 
                        style={{ width: `${Math.min(day.views * 2, 100)}px` }}
                        title={`${day.views} views`}
                      />
                      <div 
                        className="h-6 bg-green-500 rounded" 
                        style={{ width: `${Math.min(day.carts * 5, 50)}px` }}
                        title={`${day.carts} carts`}
                      />
                      <div 
                        className="h-6 bg-purple-500 rounded" 
                        style={{ width: `${Math.min(day.searches * 3, 75)}px` }}
                        title={`${day.searches} searches`}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      {day.views}V / {day.carts}C / {day.searches}S
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
