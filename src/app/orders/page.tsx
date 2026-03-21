"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import Image from "next/image"
import BuyerConfirmation from "@/app/product/[id]/components/BuyerConfirmation"

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const fetchOrders = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            setUser(user)

            // Fetch orders with their items and nested product data
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    order_items (
                        *,
                        products (*)
                    )
                `)
                .eq("buyer_id", user.id)
                .order("created_at", { ascending: false })

            if (!error && data) {
                setOrders(data)
            }

            // Fetch purchase requests
            const { data: requestData } = await supabase.rpc("get_buyer_purchase_requests", {
                p_buyer_id: user.id
            })

            if (requestData) {
                setRequests(requestData)
            }
            setLoading(false)
        }

        fetchOrders()
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <main className="bg-background min-h-screen animate-fade-in">
            <div className="section-container py-16">
                <header className="mb-16">
                    <span className="text-caption uppercase tracking-widest text-primary font-bold">Personal Portfolio</span>
                    <h1 className="text-display mt-2 italic">Institutional Records</h1>
                    <p className="text-body text-muted mt-4 max-w-xl">
                        Track your luxury acquisitions and manage your premium shipping status in one place.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                    {/* Sidebar Nav */}
                    <aside className="lg:col-span-1 space-y-2">
                        <Link href="/orders" className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 text-primary font-bold transition-smooth">
                            <span className="text-xl">📦</span>
                            <span className="text-caption uppercase tracking-widest">Acquisitions</span>
                        </Link>
                        <Link href="/wishlist" className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 text-muted hover:text-foreground transition-smooth group">
                            <span className="text-xl grayscale group-hover:grayscale-0 transition-smooth">♡</span>
                            <span className="text-caption uppercase tracking-widest">Vault</span>
                        </Link>
                        <Link href="/profile" className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 text-muted hover:text-foreground transition-smooth group">
                            <span className="text-xl grayscale group-hover:grayscale-0 transition-smooth">👤</span>
                            <span className="text-caption uppercase tracking-widest">Credentials</span>
                        </Link>
                    </aside>

                    {/* Orders List */}
                    <div className="lg:col-span-3 space-y-12">
                        {/* Purchase Requests (Direct P2P Flow) */}
                        {requests.length > 0 && (
                            <section>
                                <h2 className="text-h3 font-bold mb-8 uppercase tracking-widest text-primary/80">P2P Protocols</h2>
                                {requests.map((request) => (
                                    <div key={request.id} className="luxury-card p-8 mb-6 border-primary/20 bg-primary/5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="text-[10px] uppercase tracking-widest text-primary font-bold">{request.product_title}</span>
                                                <h3 className="text-h3 font-bold mt-1 uppercase tracking-tighter italic">Request #{request.id.slice(0, 8)}</h3>
                                                <p className="text-[10px] uppercase tracking-widest text-muted mt-1">
                                                    Merchant: {request.seller_name} • Protocol Status: {request.status}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] uppercase tracking-[0.2em] font-black px-4 py-1.5 rounded-full border shadow-sm ${
                                                request.status === 'pending' ? 'bg-black text-white border-white/20' :
                                                request.status === 'contacted' ? 'bg-blue-500 text-white' :
                                                request.status === 'completed' ? 'bg-green-500 text-white' :
                                                'bg-red-500 text-white'
                                            }`}>
                                                {request.status === 'pending' ? 'Verification Pending' : request.status}
                                            </span>
                                        </div>
                                        <p className="text-caption text-muted mb-4 font-medium">"{request.buyer_message}"</p>
                                        
                                        {request.status === 'completed' && (
                                            <BuyerConfirmation
                                                request={request}
                                                user={user}
                                                onConfirmed={() => window.location.reload()}
                                            />
                                        )}
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Standard Orders (Marketplace Checkout Flow) */}
                        <section>
                            <h2 className="text-h3 font-bold mb-8 uppercase tracking-widest text-foreground/80">Acquisition Logs</h2>
                            {orders.length === 0 ? (
                                <div className="luxury-card p-20 text-center bg-accent/10 border-dashed border-2 opacity-60">
                                    <p className="text-caption text-muted uppercase tracking-[0.3em] font-bold">No centralized acquisitions found</p>
                                    <Link href="/" className="luxury-button inline-block mt-8 !text-[10px]">Initialize Collection</Link>
                                </div>
                            ) : (
                                orders.map((order) => (
                                    <div key={order.id} className="luxury-card overflow-hidden bg-white shadow-xl mb-10 border border-border group animate-fade-in">
                                        {/* Order Header */}
                                        <div className="p-6 bg-accent/5 border-b border-border">
                                            <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] uppercase tracking-[0.3em] text-muted font-black">Transaction ID</p>
                                                    <p className="text-xs font-mono font-bold">#{order.id.split('-')[0].toUpperCase()}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] uppercase tracking-[0.3em] text-muted font-black">Date of Record</p>
                                                    <p className="text-xs font-bold">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] uppercase tracking-[0.3em] text-muted font-black">Valuation</p>
                                                    <p className="text-xs font-black text-primary">₹ {order.total_price?.toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                    <p className="text-[9px] uppercase tracking-[0.3em] text-muted font-black mb-1">State</p>
                                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm ${
                                                        order.status === 'delivered' ? 'bg-green-500 text-white border-green-600' :
                                                        order.status === 'shipped' ? 'bg-blue-500 text-white border-blue-600' :
                                                        'bg-black text-white border-black'
                                                    }`}>
                                                        {order.status || 'Pending'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Protocol Timeline */}
                                            <div className="relative pt-4 pb-2 px-4">
                                                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-border -translate-y-1/2" />
                                                <div className="relative flex justify-between items-center z-10">
                                                    {[
                                                        { id: 'confirmed', icon: '📝' },
                                                        { id: 'packed', icon: '📦' },
                                                        { id: 'shipped', icon: '🚀' },
                                                        { id: 'delivered', icon: '🏁' }
                                                    ].map((step, idx, arr) => {
                                                        const stages = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']
                                                        const currentIdx = stages.indexOf(order.status || 'pending')
                                                        const stepIdx = stages.indexOf(step.id)
                                                        const isPast = currentIdx >= stepIdx
                                                        const isCurrent = currentIdx === stepIdx

                                                        return (
                                                            <div key={step.id} className="flex flex-col items-center">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] border-2 transition-all duration-700 ${
                                                                    isPast ? 'bg-black border-black shadow-[0_0_15px_rgba(0,0,0,0.1)]' : 'bg-white border-border text-muted opacity-30'
                                                                } ${isCurrent ? 'scale-125 ring-4 ring-primary/20' : ''}`}>
                                                                    {isPast ? step.icon : '•'}
                                                                </div>
                                                                <span className={`text-[7px] uppercase tracking-[0.2em] font-black mt-3 transition-colors ${isPast ? 'text-foreground' : 'text-muted opacity-40'}`}>
                                                                    {step.id}
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Order Items */}
                                        <div className="divide-y divide-border">
                                            {order.order_items?.map((item: any) => (
                                                <div key={item.id} className="p-6 flex flex-col md:flex-row gap-8 items-center hover:bg-accent/5 transition-colors">
                                                    <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border border-border bg-accent/10 relative">
                                                        <Image
                                                            src={item.products?.image_url}
                                                            alt={item.products?.title}
                                                            fill
                                                            className="object-cover"
                                                            sizes="96px"
                                                        />
                                                    </div>

                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="text-[9px] uppercase tracking-[0.3em] text-primary font-black">{item.products?.category}</span>
                                                                <h4 className="text-base font-black uppercase tracking-tight italic mt-1">{item.products?.title}</h4>
                                                                <div className="flex items-center gap-4 mt-2">
                                                                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted border-r border-border pr-4">Size: {item.selected_size}</span>
                                                                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted">Qty: {item.quantity}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-foreground">₹ {item.price?.toLocaleString()} / unit</p>
                                                                <p className="text-[10px] uppercase tracking-widest text-muted mt-1 mt-auto">SKU: {item.products?.sku || "N/A"}</p>
                                                            </div>
                                                        </div>

                                                        {order.status === 'delivered' && (
                                                            <div className="flex items-center gap-4 pt-4 border-t border-border mt-4">
                                                                <Link
                                                                    href={`/product/${item.product_id}`}
                                                                    className="luxury-button !py-2 !px-6 !text-[9px] !bg-foreground !text-white"
                                                                >
                                                                    Submit Review
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Order Footer Actions */}
                                        <div className="p-4 bg-accent/5 border-t border-border flex justify-center gap-8 items-center overflow-x-auto whitespace-nowrap">
                                            {order.status !== 'delivered' && (
                                                <Link href={`/orders/${order.id}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:opacity-70 transition-smooth">
                                                    Access Tracking Protocol →
                                                </Link>
                                            )}
                                            {order.status === 'delivered' && !order.is_disputed && (
                                                <Link href={`/orders/dispute/${order.id}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 hover:opacity-70 transition-smooth border-l border-border pl-8">
                                                    Protocol Conflict? Initialize Dispute →
                                                </Link>
                                            )}
                                            {order.is_disputed && (
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 border-l border-border pl-8 animate-pulse">
                                                    Dispute Protocol Active ⚔️
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    )
}