"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { getTrustTier } from "@/lib/trustTier"
import SimpleSellerRequests from "@/components/SimpleSellerRequests"

export default function SellerDashboard() {
    const [orders, setOrders] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [stats, setStats] = useState({ totalRevenue: 0, pendingOrders: 0, trustScore: 0 })
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const fetchSellerData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }
            setUser(user)

            // Get seller trust score
            const { data: trustData } = await supabase
                .from("trust_scores")
                .select("score")
                .eq("user_id", user.id)
                .single()

            // Get seller products
            const { data: productsData } = await supabase
                .from("products")
                .select("*")
                .eq("user_id", user.id)

            if (productsData) {
                setProducts(productsData)
                const productIds = productsData.map(p => p.id)

                // Get orders for those products
                const { data: ordersData } = await supabase
                    .from("orders")
                    .select(`
                        *,
                        products (*)
                    `)
                    .in("product_id", productIds)
                    .order("created_at", { ascending: false })

                if (ordersData) {
                    setOrders(ordersData)
                    const revenue = ordersData.reduce((acc, curr) => acc + (curr.products?.price || 0), 0)
                    const pending = ordersData.filter(o => o.status !== "delivered").length
                    setStats({
                        totalRevenue: revenue,
                        pendingOrders: pending,
                        trustScore: trustData?.score || 0
                    })
                }
            }
            setLoading(false)
        }

        fetchSellerData()
    }, [])

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    if (!user) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
            <h2 className="text-2xl mb-4">Please Login to Access Dashboard</h2>
            <Link href="/login" className="bg-black text-white px-6 py-3 rounded-lg font-semibold">
                Login Now
            </Link>
        </div>
    )

    const currentTier = getTrustTier(stats.trustScore)

    return (
        <div className="bg-background min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

                {/* Mobile Header */}
                <div className="lg:hidden mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Seller Dashboard</h1>
                    <p className="text-sm text-gray-600 mt-1">Manage your listings and orders</p>
                </div>

                <div className="flex gap-8">

                    {/* Sidebar - Desktop */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <div className="sticky top-6 space-y-6">

                            {/* Profile Card */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                        <span className="text-lg font-semibold text-gray-600">
                                            {user?.email?.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Seller</h3>
                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${currentTier.badgeClass}`}>
                                            <span>{currentTier.icon}</span> {currentTier.label}
                                        </div>
                                    </div>
                                </div>

                                {/* Trust Score */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Trust Score</span>
                                        <span className="font-semibold">{stats.trustScore}/100</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-black h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${stats.trustScore}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <nav className="bg-white rounded-xl p-4 shadow-sm border">
                                <ul className="space-y-2">
                                    <li>
                                        <Link href="/seller/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                                            <span className="text-lg">📊</span>
                                            <span className="font-medium">Dashboard</span>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/upload" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                                            <span className="text-lg">➕</span>
                                            <span className="font-medium">Add Listing</span>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/seller/payouts" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                                            <span className="text-lg">💰</span>
                                            <span className="font-medium">Payouts</span>
                                        </Link>
                                    </li>
                                </ul>
                            </nav>

                            {/* Quick Stats */}
                            <div className="bg-white rounded-xl p-4 shadow-sm border">
                                <h4 className="font-semibold text-gray-900 mb-4">Quick Stats</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Revenue</span>
                                        <span className="font-semibold">₹{stats.totalRevenue.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Pending Orders</span>
                                        <span className="font-semibold">{stats.pendingOrders}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Active Listings</span>
                                        <span className="font-semibold">{products.length}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">

                        {/* Mobile Navigation Tabs */}
                        <div className="lg:hidden mb-6">
                            <nav className="flex border-b border-gray-200">
                                <button className="flex-1 py-3 px-4 text-center font-medium text-black border-b-2 border-black">
                                    Dashboard
                                </button>
                                <Link href="/upload" className="flex-1 py-3 px-4 text-center font-medium text-gray-600 hover:text-gray-900">
                                    Add Listing
                                </Link>
                                <Link href="/seller/payouts" className="flex-1 py-3 px-4 text-center font-medium text-gray-600 hover:text-gray-900">
                                    Payouts
                                </Link>
                            </nav>
                        </div>

                        <div className="space-y-8">

                            {/* Trust Warning - Mobile */}
                            {stats.trustScore < 50 && (
                                <div className="lg:hidden bg-red-50 border border-red-200 rounded-xl p-4">
                                    <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide mb-2">Account Restricted</h3>
                                    <p className="text-sm text-red-800">
                                        Your trust score is below 50. Complete pending deliveries to restore full access.
                                    </p>
                                </div>
                            )}

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                                <div className="bg-white rounded-xl p-6 shadow-sm border">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl">💰</span>
                                        <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Revenue</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</p>
                                </div>

                                <div className="bg-white rounded-xl p-6 shadow-sm border">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl">📦</span>
                                        <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Pending</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
                                </div>

                                <div className="bg-white rounded-xl p-6 shadow-sm border lg:col-span-1 col-span-2">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl">⭐</span>
                                        <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Trust Score</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{stats.trustScore}/100</p>
                                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-black h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${stats.trustScore}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Purchase Requests */}
                            <div className="bg-white rounded-xl shadow-sm border">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-xl font-bold text-gray-900">Purchase Requests</h2>
                                    <p className="text-sm text-gray-600 mt-1">Manage incoming buyer requests</p>
                                </div>
                                <div className="p-6">
                                    <SimpleSellerRequests sellerId={user.id} />
                                </div>
                            </div>

                            {/* Orders Management */}
                            <div className="bg-white rounded-xl shadow-sm border">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-xl font-bold text-gray-900">Order Management</h2>
                                    <p className="text-sm text-gray-600 mt-1">Track and update your orders</p>
                                </div>
                                <div className="p-6">
                                    {orders.length === 0 ? (
                                        <div className="text-center py-12">
                                            <span className="text-4xl mb-4 block">📦</span>
                                            <p className="text-gray-500">No orders yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {orders.slice(0, 5).map(order => {
                                                const prod = order.products
                                                if (!prod) return null
                                                return (
                                                    <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                                        <div className="flex items-center gap-4">
                                                            <img
                                                                src={prod.image_url || "/placeholder.jpg"}
                                                                alt={prod.title}
                                                                className="w-12 h-12 object-cover rounded-lg"
                                                            />
                                                            <div>
                                                                <h4 className="font-semibold text-gray-900">{prod.title}</h4>
                                                                <p className="text-sm text-gray-600">Order #{order.id.slice(0, 8)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                                                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                                order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {order.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
