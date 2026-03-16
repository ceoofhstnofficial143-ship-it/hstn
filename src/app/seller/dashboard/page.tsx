"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import Image from "next/image"
import { getTrustTier } from "@/lib/trustTier"

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

                if (productIds.length > 0) {
                    // Get individual order items for those products
                    const { data: itemsData } = await supabase
                        .from("order_items")
                        .select(`
                            *,
                            orders (*),
                            products (*)
                        `)
                        .in("product_id", productIds)

                    if (itemsData) {
                        // Map items to a consistent display format
                        const formattedOrders = itemsData.map(item => ({
                            ...item.orders,
                            products: item.products,
                            quantity: item.quantity,
                            item_price: item.price,
                            selected_size: item.selected_size
                        })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                        setOrders(formattedOrders)
                        
                        const revenue = itemsData.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)
                        const pending = itemsData.filter(i => i.orders?.status !== "delivered").length
                        
                        setStats({
                            totalRevenue: revenue,
                            pendingOrders: pending,
                            trustScore: trustData?.score || 0
                        })
                    }
                } else {
                    setStats(prev => ({ ...prev, trustScore: trustData?.score || 0 }))
                }
            }
            setLoading(false)
        }

        fetchSellerData()
    }, [])

    const handleDeleteProduct = async (productId: string) => {
        if (!confirm("Are you sure you want to permanently decommission this asset? This action is irreversible.")) return

        const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", productId)
            .eq("user_id", user.id)

        if (error) {
            alert(`Deactivate Protocol Failed: ${error.message}`)
        } else {
            setProducts(products.filter(p => p.id !== productId))
            alert("Asset successfully decommissioned.")
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    if (!user) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-8">
                <span className="text-3xl">👤</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-4">Authentication Required</h2>
            <p className="text-muted text-xs font-bold uppercase tracking-widest mb-10 max-w-xs">Please authorize your session to access the Merchant Command Center.</p>
            <Link href="/login" className="luxury-button !px-12 !py-4">
                Sign In Protocol
            </Link>
        </div>
    )

    const currentTier = getTrustTier(stats.trustScore)

    return (
        <div className="bg-background min-h-screen pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10">

                {/* Header Section */}
                <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-8 gap-6">
                    <div>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">Merchant Protocol</span>
                        <h1 className="text-3xl lg:text-5xl mt-2 italic font-black uppercase tracking-tighter">Command Center</h1>
                        <p className="text-muted text-[9px] mt-2 uppercase tracking-[0.2em] font-medium opacity-60">
                            Authorized Session: {user?.email}
                        </p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link href="/upload" className="luxury-button !py-4 !px-8 !text-[10px] uppercase tracking-[0.2em] font-bold shadow-lg flex-1 md:flex-none text-center">
                            + List New Asset
                        </Link>
                    </div>
                </header>

                <div className="flex flex-col lg:flex-row gap-12">

                    {/* Sidebar */}
                    <aside className="w-full lg:w-80 flex-shrink-0 space-y-8">
                        {/* Profile/Tier Card */}
                        <div className="luxury-card p-8 bg-black text-white border-none relative overflow-hidden group rounded-[2rem]">
                           <div className="absolute top-0 right-0 p-8 opacity-5">
                             <span className="text-7xl group-hover:scale-110 transition-transform duration-1000">🛡️</span>
                           </div>
                           <div className="relative z-10">
                               <div className="flex items-center gap-5 mb-8">
                                   <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                                       <span className="text-2xl font-black text-primary">
                                           {user?.email?.charAt(0).toUpperCase()}
                                       </span>
                                   </div>
                                   <div>
                                       <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">Merchant Status</p>
                                       <div className="flex items-center gap-2">
                                           <span className="text-xl">🛡️</span>
                                           <span className="text-sm font-black uppercase tracking-widest text-primary">{currentTier.label}</span>
                                       </div>
                                   </div>
                               </div>

                               <div className="space-y-4">
                                   <div className="flex justify-between items-end">
                                       <span className="text-[9px] text-white/40 uppercase font-black tracking-[0.2em]">Trust Matrix</span>
                                       <span className="text-xl font-black text-white">{stats.trustScore}%</span>
                                   </div>
                                   <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                       <div
                                           className="bg-primary h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
                                           style={{ width: `${stats.trustScore}%` }}
                                       />
                                   </div>
                                   <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] leading-relaxed">
                                       High trust scores unlock lower listing fees and premium placement in the global archive.
                                   </p>
                               </div>
                           </div>
                        </div>

                        {/* Navigation Menu */}
                        <nav className="luxury-card p-4 bg-accent/5 rounded-[2rem]">
                            <ul className="space-y-2">
                                {[
                                    { label: 'Overview', href: '/seller/dashboard', icon: '📊' },
                                    { label: 'Inventory', href: '/seller/dashboard', icon: '📦' },
                                    { label: 'Finance', href: '/seller/payouts', icon: '💰' },
                                    { label: 'Settings', href: '/profile', icon: '⚙️' }
                                ].map((item, idx) => (
                                    <li key={idx}>
                                        <Link href={item.href} className="flex items-center justify-between px-6 py-4 rounded-2xl hover:bg-black hover:text-white transition-all duration-300 group">
                                            <div className="flex items-center gap-4">
                                                <span className="text-lg opacity-40 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                                            </div>
                                            <span className="text-xs opacity-0 group-hover:opacity-40 transition-opacity">→</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 space-y-12">
                        
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { label: 'Generated Revenue', val: `₹${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-primary' },
                                { label: 'Pending Orders', val: stats.pendingOrders, icon: '📦', color: 'text-foreground' },
                                { label: 'Managed Assets', val: products.length, icon: '💎', color: 'text-foreground' }
                            ].map((stat, idx) => (
                                <div key={idx} className="luxury-card p-8 bg-white hover:shadow-2xl rounded-[2rem] transition-all duration-500 group border border-gray-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-accent/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <span className="text-xl">{stat.icon}</span>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-muted uppercase font-black tracking-widest mb-1">{stat.label}</p>
                                    <p className={`text-2xl font-black tracking-tighter ${stat.color}`}>{stat.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Inventory Management */}
                        <section className="luxury-card bg-white p-0 overflow-hidden shadow-sm border border-gray-100 rounded-[2.5rem]">
                            <div className="p-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-widest">Active Inventory</h2>
                                    <p className="text-[9px] text-muted uppercase tracking-[0.2em] mt-1">Real-time control tower for your listed assets</p>
                                </div>
                                <button onClick={() => window.location.reload()} className="text-[9px] font-black uppercase tracking-widest text-primary border-b-2 border-primary pb-1">
                                    Refresh Sync
                                </button>
                            </div>
                            
                            <div className="p-8">
                                {products.length === 0 ? (
                                    <div className="text-center py-20 opacity-40 italic">
                                        <span className="text-4xl mb-4 block">🕳️</span>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">No assets identified in local frequency.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {products.map(product => (
                                            <div key={product.id} className="group relative bg-gray-50/50 rounded-3xl p-4 border border-border/50 hover:bg-white hover:shadow-2xl transition-all duration-500">
                                                <div className="flex gap-6">
                                                    <div className="w-24 h-32 rounded-2xl overflow-hidden bg-accent/20 flex-shrink-0 relative">
                                                        <Image 
                                                            src={product.image_url || '/placeholder.jpg'} 
                                                            alt={product.title}
                                                            fill
                                                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                            sizes="96px"
                                                        />
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-between py-1">
                                                        <div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="text-[11px] font-black uppercase tracking-tight line-clamp-1">{product.title}</h4>
                                                                    <div className="flex items-center gap-3">
                                                                        <Link 
                                                                            href={`/products/edit/${product.id}`}
                                                                            className="text-[10px] opacity-20 hover:opacity-100 hover:text-black transition-all"
                                                                            title="Edit Asset"
                                                                        >
                                                                            ✏️
                                                                        </Link>
                                                                        <button 
                                                                            onClick={() => handleDeleteProduct(product.id)}
                                                                            className="text-[10px] opacity-20 hover:opacity-100 hover:text-red-500 transition-all font-bold"
                                                                            title="Decommission Asset"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                            </div>
                                                            <p className="text-lg font-black text-foreground mt-1">₹{product.price.toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                                <span className="text-[9px] uppercase font-bold text-muted tracking-widest">Stock: {product.stock}</span>
                                                            </div>
                                                            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${product.admin_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                {product.admin_status || 'Pending'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Recent Orders Hub */}
                        <section className="luxury-card bg-white p-8 border border-gray-100 rounded-[2.5rem]">
                            <header className="mb-8 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-widest">Acquisition Hub</h2>
                                    <p className="text-[9px] text-muted uppercase tracking-[0.2em] mt-1">Transaction stream and fulfillment protocols</p>
                                </div>
                            </header>
                            
                            <div className="space-y-6">
                                {orders.length === 0 ? (
                                    <div className="text-center py-20 bg-accent/5 rounded-[2rem] border border-dashed border-border">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted opacity-40">No incoming frequencies detected.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {orders.slice(0, 6).map(order => {
                                            const prod = order.products
                                            if (!prod) return null
                                            return (
                                                <div key={order.id} className="py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:bg-accent/5 px-4 rounded-2xl transition-all group">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-14 bg-accent/20 rounded-xl overflow-hidden relative">
                                                            <Image 
                                                              src={prod.image_url || '/placeholder.jpg'} 
                                                              alt={prod.title} 
                                                              fill 
                                                              className="object-cover"
                                                              sizes="56px"
                                                            />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-tight">{prod.title}</h4>
                                                            <p className="text-[9px] text-muted font-bold mt-1 uppercase tracking-widest font-mono">ID: #{order.id.slice(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
                                                        <div className="text-right">
                                                            <p className="text-xs font-black text-foreground">₹{(order.item_price || prod.price).toLocaleString()} <span className="text-[9px] text-muted ml-1">x {order.quantity || 1}</span></p>
                                                            <p className="text-[9px] text-muted font-bold uppercase tracking-widest mt-1">Acquired Value</p>
                                                        </div>
                                                        <div className={`px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border shadow-sm ${
                                                            order.status === 'delivered' ? 'bg-green-50 border-green-200 text-green-700' :
                                                            order.status === 'shipped' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                            'bg-primary/10 border-primary/20 text-primary'
                                                        }`}>
                                                            {order.status}
                                                        </div>
                                                        <span className="text-lg opacity-0 group-hover:opacity-40 transition-opacity hidden sm:block">→</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>

                    </main>
                </div>
            </div>
        </div>
    )
}

