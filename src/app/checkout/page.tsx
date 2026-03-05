"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getTrustTier } from "@/lib/trustTier"
import { supabase } from "@/lib/supabase"

export default function CheckoutPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCartTrust = async () => {
      const items = JSON.parse(localStorage.getItem("hstn-checkout-items") || "[]")
      if (items.length === 0) {
        router.push("/cart")
        return
      }

      const itemsWithTrust = await Promise.all(items.map(async (item: any) => {
        if (!item.trust) {
          const { data: trust } = await supabase
            .from("trust_scores")
            .select("score, verified")
            .eq("user_id", item.user_id)
            .single()
          return { ...item, trust }
        }
        return item
      }))

      setCartItems(itemsWithTrust)
      setLoading(false)
    }
    fetchCartTrust()
  }, [router])

  const total = cartItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0)

  const handlePlaceOrder = () => {
    alert("Protocol Synchronized: Acquisition Confirmed! 🎉")

    // Remove only the items that were checked out
    const fullCart = JSON.parse(localStorage.getItem("hstn-cart") || "[]")
    const purchasedIds = cartItems.map(i => i.id)
    const remainingCart = fullCart.filter((item: any) => !purchasedIds.includes(item.id))

    localStorage.setItem("hstn-cart", JSON.stringify(remainingCart))
    localStorage.removeItem("hstn-checkout-items")

    window.dispatchEvent(new Event("hstn-cart-updated"))
    router.push("/orders")
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="bg-background min-h-screen animate-fade-in py-20 pb-40">
      <div className="section-container max-w-4xl">
        <div className="mb-12 space-y-4">
          <div className="luxury-card bg-[#0A0A0A] border-border p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="text-8xl">🛡️</span>
            </div>
            <div className="flex items-start gap-4 z-10">
              <span className="text-3xl mt-1">🛡️</span>
              <div>
                <p className="text-caption font-bold uppercase tracking-[0.2em] text-white">HSTN Escrow Protection</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-[10px] text-green-500 uppercase tracking-widest font-bold">Your payment is held securely.</p>
                </div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1 leading-relaxed">
                  Funds release to the seller only after delivery confirmation.<br className="hidden sm:block" />
                  Full refund protocol active if the physical asset does not match the motion capture.
                </p>
              </div>
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-lg text-[9px] font-bold text-white uppercase tracking-[0.2em] border border-white/10 whitespace-nowrap z-10 shadow-lg backdrop-blur-md">
              Institutional Grade Security
            </div>
          </div>
        </div>

        <header className="mb-16 text-center">
          <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">Secure Gateway</span>
          <h1 className="text-display mt-2 uppercase tracking-tighter">Acquisition Protocol</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
          <div className="lg:col-span-3 space-y-12">
            {/* Section 1: Shipping */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-foreground text-card flex items-center justify-center text-[10px] font-bold">1</span>
                <h2 className="text-h3 uppercase tracking-widest font-bold">Destinations</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <input placeholder="Full Name" className="sm:col-span-2 bg-accent/20 border-none rounded-xl px-6 py-4 text-body outline-none focus:ring-1 ring-primary transition-smooth" />
                <input placeholder="Shipping Address" className="sm:col-span-2 bg-accent/20 border-none rounded-xl px-6 py-4 text-body outline-none focus:ring-1 ring-primary transition-smooth" />
                <input placeholder="City" className="bg-accent/20 border-none rounded-xl px-6 py-4 text-body outline-none focus:ring-1 ring-primary transition-smooth" />
                <input placeholder="Phone Number" className="bg-accent/20 border-none rounded-xl px-6 py-4 text-body outline-none focus:ring-1 ring-primary transition-smooth" />
              </div>
            </section>

            <div className="h-px bg-border" />

            {/* Section 2: Payment */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-foreground text-card flex items-center justify-center text-[10px] font-bold">2</span>
                <h2 className="text-h3 uppercase tracking-widest font-bold">Protocol</h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 p-6 rounded-2xl border-2 transition-smooth text-left ${paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border opacity-60"}`}
                >
                  <p className="text-caption font-bold uppercase tracking-widest mb-2">Prepaid Card</p>
                  <p className="text-[10px] text-muted">Instant processing • Secured by 256-bit encryption</p>
                </button>
                <button
                  onClick={() => setPaymentMethod("cod")}
                  className={`flex-1 p-6 rounded-2xl border-2 transition-smooth text-left ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border opacity-60"}`}
                >
                  <p className="text-caption font-bold uppercase tracking-widest mb-2">Cash on Delivery</p>
                  <p className="text-[10px] text-muted">Verify on arrival • Restricted to selected PIN codes</p>
                </button>
              </div>

              {paymentMethod === "card" && (
                <div className="luxury-card p-10 bg-accent/10 border-none space-y-6 animate-fade-in">
                  <input placeholder="Full Name on Card" className="w-full bg-white border border-border rounded-xl px-6 py-4 text-body outline-none focus:border-primary transition-smooth" />
                  <input placeholder="16 Digit Card Number" className="w-full bg-white border border-border rounded-xl px-6 py-4 text-body outline-none focus:border-primary transition-smooth" />
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="MM / YY" className="bg-white border border-border rounded-xl px-6 py-4 text-body outline-none focus:border-primary transition-smooth" />
                    <input placeholder="CVC" className="bg-white border border-border rounded-xl px-6 py-4 text-body outline-none focus:border-primary transition-smooth" />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Sidebar Summary */}
          <div className="lg:col-span-2">
            <div className="luxury-card p-6 sm:p-10 bg-foreground text-card space-y-8 lg:sticky lg:top-28 border-none">
              <h3 className="text-caption font-bold uppercase tracking-widest text-primary">Acquisition Summary</h3>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {cartItems.map(item => {
                  const tier = getTrustTier(item.trust?.score)
                  return (
                    <div key={item.id} className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-smooth">

                      {/* Status Reinforcement Block */}
                      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                        <div className="w-10 h-10 rounded-full bg-black border border-white/20 flex items-center justify-center text-lg shadow-lg">
                          {tier.icon}
                        </div>
                        <div className="flex-1">
                          <p className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5 ${tier.name === 'Probation' ? 'text-white' : 'text-primary'}`}>
                            {tier.label}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[8px] text-white/50 uppercase tracking-widest">
                            <span className="text-green-500 font-bold">99.4% Fulfillment</span>
                            <span>•</span>
                            <span>3-Day Protection</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        {item.image_url && (
                          <div className="w-16 h-20 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10">
                            <img src={item.image_url} className="w-full h-full object-cover" alt={item.title} />
                          </div>
                        )}

                        <div className="flex flex-col flex-1 justify-between py-1">
                          <div>
                            <div className="flex justify-between items-start text-caption">
                              <span className="text-white/80 line-clamp-2 leading-relaxed font-medium">{item.title}</span>
                            </div>
                            <span className="font-bold text-primary text-body mt-1 block">₹ {(item.price * (item.quantity || 1)).toLocaleString()}</span>
                          </div>

                          {/* Trusted Fabric Seller Signal */}
                          {(item.trust?.verified || item.video_url) && (
                            <div className="flex items-start gap-2 mt-3 p-2 bg-green-500/10 rounded-md border border-green-500/20">
                              <span className="text-green-500 text-xs mt-0.5">🛡️</span>
                              <div>
                                <p className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Video-Verified Fabric</p>
                                <p className="text-[8px] text-green-500/70 uppercase tracking-tighter mt-0.5">Authenticated through motion capture.</p>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Urgency Layer (Real Activity) */}
              <div className="flex items-center justify-center gap-3 py-3 px-4 bg-white/5 rounded-xl border border-white/10 text-center">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-[9px] uppercase tracking-widest text-primary font-bold">
                  High Demand • 3 buyers viewed this seller in the last hour
                </span>
              </div>

              <div className="h-px bg-white/10" />

              <div className="space-y-4">
                <div className="flex justify-between text-caption uppercase tracking-widest">
                  <span className="text-white/40">Acquisition Total</span>
                  <span className="text-primary font-bold">₹ {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-caption uppercase tracking-widest">
                  <span className="text-white/40">Logistics Index</span>
                  <span className="text-green-500">Tier 1 • Comp</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                className="luxury-button w-full !text-[11px] uppercase tracking-[0.3em] font-bold"
              >
                Launch Transaction
              </button>

              <div className="text-[9px] text-center text-white/30 uppercase tracking-[0.2em] leading-relaxed">
                <p>Escrow payment verified by HSTN Network</p>
                <p>White-glove delivery guaranteed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
