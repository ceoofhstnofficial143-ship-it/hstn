"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import BuyerConfirmation from "@/components/BuyerConfirmation"

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUser(user) // Set user state

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          products ( title, image_url, price, category )
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })

      // Fetch purchase requests
      const { data: requestData } = await supabase.rpc("get_buyer_purchase_requests", {
        p_buyer_id: user.id
      })

      if (!error && data) {
        setOrders(data)
      }
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
          <h1 className="text-display mt-2">Manage Your Orders</h1>
          <p className="text-body text-muted mt-4 max-w-xl">
            Track your luxury acquisitions and manage your premium shipping status in one place.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Sidebar Nav */}
          <aside className="lg:col-span-1 space-y-2">
            <Link href="/orders" className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 text-primary font-bold transition-smooth">
              <span className="text-xl">📦</span>
              <span className="text-caption uppercase tracking-widest">My Orders</span>
            </Link>
            <Link href="/wishlist" className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 text-muted hover:text-foreground transition-smooth group">
              <span className="text-xl grayscale group-hover:grayscale-0 transition-smooth">♡</span>
              <span className="text-caption uppercase tracking-widest">Wishlist</span>
            </Link>
            <Link href="/profile" className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 text-muted hover:text-foreground transition-smooth group">
              <span className="text-xl grayscale group-hover:grayscale-0 transition-smooth">👤</span>
              <span className="text-caption uppercase tracking-widest">Settings</span>
            </Link>
          </aside>

          {/* Orders List */}
          <div className="lg:col-span-3 space-y-8">
            {/* Purchase Requests */}
            <section>
              <h2 className="text-h2 font-bold mb-8 uppercase tracking-widest">Purchase Requests</h2>
              {requests.length === 0 ? (
                <div className="luxury-card p-12 text-center bg-accent/20 border-dashed border-2">
                  <p className="text-body text-muted uppercase tracking-widest">No pending requests</p>
                  <Link href="/products" className="luxury-button inline-block mt-6 !text-xs">Browse Products</Link>
                </div>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="luxury-card p-8 mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-primary font-bold">{request.product_title}</span>
                        <h3 className="text-h3 font-bold mt-1">Request #{request.id.slice(0, 8)}</h3>
                        <p className="text-[10px] uppercase tracking-widest text-muted mt-1">
                          Seller: {request.seller_name} • Status: {request.status}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        request.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                        request.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                    
                    <p className="text-caption text-muted mb-4">"{request.buyer_message}"</p>
                    
                    {request.status === 'completed' && (
                      <BuyerConfirmation
                        request={request}
                        user={user}
                        onConfirmed={() => {
                          // Refresh requests after confirmation
                          const fetchUpdatedRequests = async () => {
                            const { data: requestData } = await supabase.rpc("get_buyer_purchase_requests", {
                              p_buyer_id: user.id
                            })
                            if (requestData) {
                              setRequests(requestData)
                            }
                          }
                          fetchUpdatedRequests()
                        }}
                      />
                    )}
                  </div>
                ))
              )}
            </section>

            {/* Traditional Orders */}
            {orders.length === 0 ? (
              <div className="luxury-card p-20 text-center bg-accent/20 border-dashed border-2">
                <p className="text-body text-muted uppercase tracking-widest">No acquisitions found</p>
                <Link href="/" className="luxury-button inline-block mt-8 !text-xs">Start Collection</Link>
              </div>
            ) : (
              orders.map((order) => {
                const product = order.products
                if (!product) return (
                  <div key={order.id} className="luxury-card p-8 flex items-center gap-4">
                    <span className="text-muted text-caption">Order #{order.id.slice(0, 8)} — product no longer available</span>
                  </div>
                )
                return (
                <div key={order.id} className="luxury-card p-8 flex flex-col md:flex-row gap-8 items-center group">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden flex-shrink-0 relative">
                    <img
                      src={product.image_url}
                      className="w-full h-full object-cover transition-smooth group-hover:scale-110"
                      alt={product.title}
                    />
                    <div className="absolute inset-0 bg-black/10" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-primary font-bold">{product.category}</span>
                        <h2 className="text-h3 font-bold">{product.title}</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-body font-bold text-primary">₹ {product.price?.toLocaleString() ?? "—"}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted">ID: #{order.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-4 border-t border-border">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Status</p>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-100' :
                          'bg-primary/5 text-primary border-primary/10'
                          }`}>
                          {order.status || 'Processing'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Acquisition Date</p>
                        <p className="text-caption font-semibold">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      {order.status === 'delivered' ? (
                        <div className="ml-auto flex items-center gap-4">
                          {!order.fit_feedback ? (
                            <div className="flex flex-col items-end gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                              <p className="text-[9px] uppercase tracking-widest font-bold text-primary">Internal Integrity: How was the fit?</p>
                              <div className="flex gap-2">
                                {["Tight", "Perfect", "Loose"].map(fit => (
                                  <button
                                    key={fit}
                                    onClick={async () => {
                                      const { error } = await supabase.from("orders").update({ fit_feedback: fit }).eq("id", order.id);
                                      if (!error) {
                                        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, fit_feedback: fit } : o));
                                      }
                                    }}
                                    className="px-3 py-1 bg-white border border-border rounded-lg text-[9px] font-bold uppercase tracking-widest hover:border-primary transition-smooth"
                                  >
                                    {fit}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[9px] uppercase tracking-[0.2em] text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-full">
                              Fit Reference Recorded
                            </div>
                          )}

                          {/* Damage Reporting Framework */}
                          {!order.dispute_status && (
                            <div className="relative group/dispute">
                              <button className="luxury-button !py-2 !px-4 !text-[10px] !bg-background !text-muted border-dashed border hover:border-red-500 hover:text-red-500 transition-smooth">
                                Report Issue ⚠️
                              </button>
                              <div className="absolute bottom-full right-0 mb-2 w-48 bg-foreground p-2 rounded-xl text-background shadow-2xl opacity-0 invisible group-hover/dispute:opacity-100 group-hover/dispute:visible transition-smooth">
                                <p className="text-[8px] uppercase tracking-widest text-primary font-bold mb-2 px-2 pt-1 border-b border-white/10 pb-2">Institutional Review</p>
                                {[
                                  { label: "Wrong Item", reason: "wrong_item", event: "WRONG_PRODUCT" },
                                  { label: "Size Malfunction", reason: "size_issue", event: "SIZE_ANOMALY" },
                                  { label: "Color Mismatch", reason: "color_mismatch", event: "POOR_VIDEO" }
                                ].map(issue => (
                                  <button
                                    key={issue.reason}
                                    onClick={async () => {
                                      const { error } = await supabase.from("orders").update({ dispute_status: "review", dispute_reason: issue.reason }).eq("id", order.id);
                                      if (error) {
                                        alert("Failed to submit: " + error.message);
                                        return
                                      }
                                      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, dispute_status: "review" as const } : o));
                                      alert("Protocol Activated: Issue submitted to Admin Tribunal.");
                                    }}
                                    className="block w-full text-left px-3 py-2 text-[10px] uppercase font-bold text-white/70 hover:bg-white/10 hover:text-primary rounded-lg transition-colors"
                                  >
                                    {issue.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {order.dispute_status === 'review' && (
                            <span className="text-[9px] uppercase tracking-widest text-red-500 font-bold border border-red-500/20 bg-red-500/5 px-3 py-1.5 rounded-full">
                              Under Tribunal Review
                            </span>
                          )}

                          <Link
                            href={`/products/${order.product_id}`}
                            className="luxury-button !py-2 !px-6 !text-[10px] !bg-foreground !text-white"
                          >
                            Review Acquisition
                          </Link>
                        </div>
                      ) : (
                        <button className="ml-auto text-caption font-bold uppercase tracking-widest border-b border-primary text-primary hover:opacity-70 transition-smooth">
                          Track Delivery
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      </div>
    </main>
  )
}