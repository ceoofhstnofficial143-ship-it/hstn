"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function AdminPage() {
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [user, setUser] = useState<any>(null)

    const [stats, setStats] = useState({
        users: 0,
        products: 0,
        orders: 0,
        revenue: 0
    })
    const [topSellers, setTopSellers] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [reviewQueue, setReviewQueue] = useState<any[]>([])

    useEffect(() => {
        const init = async () => {
            await checkAdmin()
            fetchStats()
        }
        init()
    }, [])

    const checkAdmin = async () => {
        setLoading(true)
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)

        if (!u) {
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", u.id)
            .single()

        if (data?.role === "admin") {
            setIsAdmin(true)
        }

        setLoading(false)
    }

    const fetchStats = async () => {
        const { count: userCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })

        const { count: productCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })

        const { count: orderCount } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })

        const { data: deliveredOrders } = await supabase
            .from("orders")
            .select("products(price)")
            .eq("status", "delivered")

        const revenue = deliveredOrders?.reduce((sum: number, order: any) => {
            return sum + (order.products?.price || 0)
        }, 0) || 0

        setStats({
            users: userCount || 0,
            products: productCount || 0,
            orders: orderCount || 0,
            revenue
        })

        // NEW: Fetch products needing admin review
        const { data: reviewQueue } = await supabase
            .from("products")
            .select(`
                id,
                title,
                image_url,
                user_id,
                admin_status,
                created_at,
                profiles:user_id(username)
            `)
            .eq("admin_status", "needs_review")
            .order("created_at", { ascending: false })

        setReviewQueue(reviewQueue || [])
        const { data: delivered } = await supabase
            .from("orders")
            .select(`
                seller_id,
                products(price),
                profiles:seller_id(username)
            `)
            .eq("status", "delivered")

        if (delivered) {
            const sellerMap: any = {}

            delivered.forEach((order: any) => {
                const sellerId = order.seller_id
                const price = order.products?.price || 0
                const username = order.profiles?.username || 'Unknown Entity'

                if (!sellerMap[sellerId]) {
                    sellerMap[sellerId] = {
                        username,
                        revenue: 0
                    }
                }

                sellerMap[sellerId].revenue += price
            })

            const sorted = Object.values(sellerMap)
                .sort((a: any, b: any) => b.revenue - a.revenue)
                .slice(0, 5)

            setTopSellers(sorted)
        }

        // NEW: Fetch All Users for Governance
        const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false })
        if (profiles) setAllUsers(profiles)

        // NEW: Fetch All Products for Supervision
        const { data: products } = await supabase
            .from("products")
            .select("id, title, price, user_id, video_url, admin_status")
            .order("created_at", { ascending: false })
        if (products) setAllProducts(products)
    }

    const reviewAction = async (id: string, action: 'approved' | 'rejected' | 'reupload', sellerId: string) => {
        console.log(`Review action: ${action} for product ${id}`)
        let reason = "";

        if (action === "rejected") {
            reason = prompt("Provide reason for rejection (e.g. AI filtered, poor lighting):") || "Violation of Verification Standards";
        } else if (action === "reupload") {
            reason = prompt("What needs to be fixed for re-upload?") || "Please retake in natural light without filters.";
        }

        const { error } = await supabase.from("products").update({
            admin_status: action
        }).eq("id", id);

        if (error) {
            console.error("Review action error:", error)
            alert(`Failed to ${action}: ${error.message}`)
        } else {
            console.log(`Successfully ${action} product ${id}`)
            fetchStats();
        }
    }

    const deleteProduct = async (id: string) => {
        console.log(`Soft deleting product ${id}`)
        const confirmDelete = confirm("ACTIVATE OVERRIDE: Are you certain you want to redact this listing from the market? This will hide it from buyers.")
        if (!confirmDelete) return

        const { error } = await supabase
            .from("products")
            .update({ admin_status: 'deleted', title: '[REDACTED]' }) // Soft delete
            .eq("id", id)

        if (error) {
            console.error("Soft delete error:", error)
            alert(`Override Failed: ${error.message}`)
        } else {
            console.log(`Successfully soft deleted product ${id}`)
            fetchStats()
        }
    }

    const permanentDeleteProduct = async (id: string) => {
        console.log(`Permanently deleting product ${id}`)
        const confirmDelete = confirm("⚠️ PERMANENT DELETION: This will completely remove the product from the database. This action cannot be undone. Are you sure?")
        if (!confirmDelete) return

        try {
            // Use RPC function for safe deletion
            const { error } = await supabase.rpc('permanent_delete_product', { product_uuid: id })

            if (error) {
                console.error("Permanent delete error:", error)
                alert(`Permanent deletion failed: ${error.message}`)
            } else {
                console.log(`Successfully permanently deleted product ${id}`)
                fetchStats()
            }
        } catch (error) {
            console.error("Unexpected error during permanent delete:", error)
            alert("Unexpected error during permanent deletion")
        }
    }

    const toggleAdmin = async (targetUser: any) => {
        console.log(`Toggling admin for user ${targetUser.id}`)
        const newRole = targetUser.role === 'admin' ? 'user' : 'admin'
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', targetUser.id)

        if (error) {
            console.error("Toggle admin error:", error)
            alert(`Protocol failure: ${error.message}`)
        } else {
            console.log(`Successfully changed role to ${newRole}`)
            fetchStats()
        }
    }

    const toggleBan = async (id: string, currentStatus: boolean) => {
        console.log(`Toggling ban for user ${id}`)
        const { error } = await supabase
            .from("profiles")
            .update({ is_banned: !currentStatus })
            .eq("id", id)

        if (error) {
            console.error("Ban error:", error)
            alert(`Ban protocol failed: ${error.message}`)
        } else {
            console.log(`Successfully ${!currentStatus ? 'banned' : 'restored'} user ${id}`)
            fetchStats()
        }
    }

    const approveProduct = async (id: string) => {
        console.log(`AI Review: Approving product ${id}`)
        const confirmApprove = confirm("✅ Approve this listing? It will be published to the marketplace.")
        if (!confirmApprove) return

        const { error } = await supabase
            .from("products")
            .update({ admin_status: 'approved' })
            .eq("id", id)

        if (error) {
            console.error("Approval error:", error)
            alert(`Approval failed: ${error.message}`)
        } else {
            console.log(`Successfully approved product ${id}`)
            fetchStats() // Refresh the dashboard
        }
    }

    const rejectProduct = async (id: string) => {
        console.log(`AI Review: Rejecting product ${id}`)
        const reason = prompt("Reason for rejection (e.g. AI detected suspicious content, stolen images):") || "AI flagged as suspicious"
        const confirmReject = confirm(`❌ Reject this listing?\nReason: ${reason}\n\nThis will hide it from buyers.`)
        if (!confirmReject) return

        const { error } = await supabase
            .from("products")
            .update({ 
                admin_status: 'rejected',
                review_reason: reason 
            })
            .eq("id", id)

        if (error) {
            console.error("Rejection error:", error)
            alert(`Rejection failed: ${error.message}`)
        } else {
            console.log(`Successfully rejected product ${id}`)
            fetchStats() // Refresh the dashboard
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium">Verifying authorization credentials...</p>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <main className="max-w-xl mx-auto px-6 py-24 text-center">
                <div className="bg-red-50 border border-red-100 rounded-[32px] p-12 shadow-sm">
                    <span className="text-6xl mb-6 block">🚫</span>
                    <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Access Denied</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed">
                        This module is restricted to platform administrators. If you believe this is an error, please contact the system proprietor.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Link href="/">
                            <button className="w-full bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-black transition-all">
                                Return to Discovery
                            </button>
                        </Link>
                        {!user && (
                            <Link href="/login">
                                <button className="w-full bg-white border border-slate-200 text-slate-600 px-8 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all">
                                    Sign In as Administrator
                                </button>
                            </Link>
                        )}
                    </div>
                    {user && (
                        <div className="mt-8 pt-8 border-t border-red-100">
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Authenticated ID</p>
                            <code className="text-[10px] text-red-500 bg-red-100 px-2 py-1 rounded truncate block">{user.id}</code>
                            <p className="text-[10px] text-slate-400 mt-2 italic">Role: {user.role || "user"}</p>
                        </div>
                    )}
                </div>
            </main>
        )
    }

    return (
        <main className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Master Protocol</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight">Admin <span className="text-blue-600">Command.</span></h1>
                    <p className="text-slate-400 font-medium italic mt-2">Platform governance and liquidity monitoring interface.</p>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <div className="px-6 py-2 bg-white rounded-xl shadow-sm font-bold text-slate-900 text-sm">System Status: Active</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <section className="lg:col-span-2 space-y-10">
                    <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-premium">
                        <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                            <span>📊</span> Global Analytics
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-premium">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">🏛️</div>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Liquid</span>
                                </div>
                                <p className="text-4xl font-black text-slate-900 mb-1">₹ {stats.revenue.toLocaleString()}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Revenue (Delivered)</p>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-premium">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">📦</div>
                                    <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">Active</span>
                                </div>
                                <p className="text-4xl font-black text-slate-900 mb-1">{stats.products}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Listings</p>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-premium">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">👥</div>
                                </div>
                                <p className="text-4xl font-black text-slate-900 mb-1">{stats.users}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Entities</p>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-premium">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600">🧾</div>
                                </div>
                                <p className="text-4xl font-black text-slate-900 mb-1">{stats.orders}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transactions</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-premium">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <span>🏆</span> Market Leaders
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top 5 by Revenue</span>
                        </div>

                        {topSellers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300 italic border-2 border-dashed border-slate-50 rounded-3xl">
                                <span className="text-4xl mb-4 grayscale opacity-30">🥈</span>
                                No closed deals recorded in current epoch.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topSellers.map((seller, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-white hover:shadow-lg transition-premium group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                index === 1 ? 'bg-slate-200 text-slate-600' :
                                                    index === 2 ? 'bg-orange-100 text-orange-700' :
                                                        'bg-white text-slate-400'
                                                }`}>
                                                #{index + 1}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">@{seller.username}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Market Partner</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-slate-900">₹ {seller.revenue.toLocaleString()}</p>
                                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none mt-1">Verified Yield</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Review Queue - NEW */}
                    <div className="bg-white border border-amber-100 rounded-[40px] p-10 shadow-premium">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <span>🤖</span> AI Review Queue
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full">
                                    {reviewQueue.length} pending
                                </span>
                            </div>
                        </div>

                        {reviewQueue.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300 italic border-2 border-dashed border-slate-50 rounded-3xl">
                                <span className="text-4xl mb-4 grayscale opacity-30">✅</span>
                                All listings verified. No manual review needed.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reviewQueue.map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex items-center justify-between p-5 bg-amber-50 rounded-2xl border border-amber-100 hover:border-amber-200 hover:bg-amber-25 hover:shadow-lg transition-premium group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No img</div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1">{product.title}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                                                    by @{product.profiles?.username || 'Unknown'}
                                                </p>
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mt-1">
                                                    AI Flagged: Suspicious content
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => approveProduct(product.id)}
                                                className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors"
                                            >
                                                ✅ Approve
                                            </button>
                                            <button
                                                onClick={() => rejectProduct(product.id)}
                                                className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                ❌ Reject
                                            </button>
                                            <Link href={`/products/${product.id}`} target="_blank">
                                                <button className="px-4 py-2 bg-slate-500 text-white text-xs font-bold rounded-lg hover:bg-slate-600 transition-colors">
                                                    👁️ View
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-premium">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <span>📦</span> Product Supervision
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Catalog</span>
                        </div>

                        <div className="space-y-4">
                            {allProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-white hover:shadow-lg transition-premium group gap-4"
                                >
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3">
                                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{product.title}</p>
                                            {product.admin_status === 'pending' && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-black uppercase tracking-widest">Pending Review</span>}
                                            {product.admin_status === 'needs_review' && <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-black uppercase tracking-widest">Needs Review</span>}
                                            {product.admin_status === 'rejected' && <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-black uppercase tracking-widest">Rejected</span>}
                                            {product.video_url && <span className="text-[10px]">🎥</span>}
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Valuation: ₹ {product.price.toLocaleString()}</p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {product.admin_status === 'pending' && (
                                            <>
                                                <button onClick={() => reviewAction(product.id, 'approved', product.user_id)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Approve Validation</button>
                                                <button onClick={() => reviewAction(product.id, 'reupload', product.user_id)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Req. Re-upload</button>
                                                <button onClick={() => reviewAction(product.id, 'rejected', product.user_id)} className="bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Reject File</button>
                                            </>
                                        )}
                                        {product.admin_status === 'needs_review' && (
                                            <>
                                                <button onClick={() => reviewAction(product.id, 'approved', product.user_id)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Approve Review</button>
                                                <button onClick={() => reviewAction(product.id, 'rejected', product.user_id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Reject</button>
                                            </>
                                        )}
                                        {product.admin_status === 'deleted' && (
                                            <button
                                                onClick={() => permanentDeleteProduct(product.id)}
                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                                            >
                                                Permanent Delete
                                            </button>
                                        )}
                                        {product.video_url && (
                                            <a href={product.video_url} target="_blank" className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                                                View Asset
                                            </a>
                                        )}
                                        <button
                                            onClick={() => deleteProduct(product.id)}
                                            className="bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ml-4"
                                        >
                                            Redact Entirely
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {allProducts.length === 0 && (
                                <div className="py-20 text-center text-slate-300 italic">
                                    Market catalog is currently vacant.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-premium">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <span>👥</span> User Governance
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Entities</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Level</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Moderation</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {allUsers.map((u) => (
                                        <tr key={u.id} className="group transition-colors hover:bg-slate-50/50">
                                            <td className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                                                        {u.username?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">@{u.username}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{u.id.slice(0, 8)}...</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${u.role === 'admin'
                                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                    {u.role || 'user'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right">
                                                <button
                                                    onClick={() => toggleBan(u.id, u.is_banned)}
                                                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all border ${u.is_banned
                                                        ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                                                        : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                                        }`}
                                                >
                                                    {u.is_banned ? 'Restore Access' : 'Ban Entity'}
                                                </button>
                                            </td>
                                            <td className="py-4 text-right">
                                                <button
                                                    onClick={() => toggleAdmin(u)}
                                                    disabled={u.id === user?.id}
                                                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all ${u.id === user?.id
                                                        ? 'opacity-20 cursor-not-allowed'
                                                        : 'bg-slate-900 text-white hover:bg-black active:scale-90'
                                                        }`}
                                                >
                                                    {u.role === 'admin' ? 'Revoke Power' : 'Grant Admin'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {allUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-20 text-center text-slate-300 italic">
                                                No secondary entities detected in secure repository.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section className="space-y-10">
                    <div className="bg-slate-900 text-white rounded-[40px] p-10 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <h3 className="text-xl font-bold mb-6 relative z-10 flex items-center gap-2">
                            <span>⚡</span> Quick Actions
                        </h3>
                        <div className="space-y-3 relative z-10">
                            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-left p-4 rounded-2xl transition-all border border-white/5 font-semibold text-sm">
                                Update System Config
                            </button>
                            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-left p-4 rounded-2xl transition-all border border-white/5 font-semibold text-sm">
                                Audit Transaction Logs
                            </button>
                            <button className="w-full bg-red-500 hover:bg-red-600 text-white text-left p-4 rounded-2xl transition-all font-bold text-sm shadow-lg shadow-red-900/20">
                                Emergency Protocol: OFF
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-premium">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
                            <span>📜</span> System Logs
                        </h3>
                        <div className="space-y-4">
                            <div className="flex gap-3 text-[10px] text-slate-400 font-mono">
                                <span>[11:42:33]</span>
                                <span className="text-slate-600">Admin Page initialization successful</span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-slate-400 font-mono">
                                <span>[11:42:30]</span>
                                <span className="text-slate-600">Supabase Auth check completed</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
