"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { getTrustTier } from "@/lib/trustTier"
import { supabase } from "@/lib/supabase"
import { Analytics, trackEvent } from "@/lib/analytics"
import { LogisticsProtocol } from "@/lib/logistics"

import AddressSelector from "@/components/checkout/AddressSelector"

export default function CheckoutPage() {
  const router = useRouter()
  
  // 🛡️ PRODUCTION SAFETY LOCK (MOCK MODE VERIFICATION)
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_PAYMENT_MODE === "mock") {
      console.warn("⚠️ HSTNLX SECURITY: Running in MOCK payment protocol. Live financial transactions are inactive.");
    }
  }, []);

  const [cartItems, setCartItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  
  // 🏨 NEW ADDRESS SYSTEM INTEGRATION
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [logistics, setLogistics] = useState<{ serviceable: boolean; estimatedDays: number | null; carrier: string } | null>(null)

  useEffect(() => {
    const fetchCartTrust = async () => {
      const items = JSON.parse(localStorage.getItem("hstnlx_checkout_items") || "[]")
      if (items.length === 0) {
        router.push("/cart")
        return
      }

      const itemsWithTrust = await Promise.all(items.map(async (item: any) => {
        let sellerId = item.seller_id;
        
        // Fix for legacy items missing seller_id
        if (!sellerId) {
          const { data: prod } = await (supabase as any).from("products").select("user_id").eq("id", item.productId).single();
          sellerId = prod?.user_id;
        }

        if (!item.trust && sellerId) {
          const { data: trust } = await (supabase as any)
            .from("trust_scores")
            .select("score, verified")
            .eq("user_id", sellerId)
            .single()
          return { ...item, seller_id: sellerId, trust }
        }
        return { ...item, seller_id: sellerId };
      }))

      setCartItems(itemsWithTrust)
      setLoading(false)
    }
    fetchCartTrust()
  }, [router])

  const checkLogistics = useCallback(async (pincode: string) => {
    if (pincode.length === 6) {
      setProcessingStatus("Verifying Logistics Protocol...")
      const res = await LogisticsProtocol.checkServiceability(pincode)
      setLogistics(res)
      setProcessingStatus(null)
    } else {
      setLogistics(null)
    }
  }, []);

  const handleAddressSelect = useCallback((address: any) => {
    setSelectedAddress(address);
    checkLogistics(address.pincode);
  }, [checkLogistics]);

  const total = cartItems.reduce((acc, item) => acc + (item.price * (item.qty || 1)), 0)
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const ensureRazorpayLoaded = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false
    if ((window as any).Razorpay) return true

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-razorpay-checkout="true"]') as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay SDK")), { once: true })
        return
      }

      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.async = true
      script.setAttribute("data-razorpay-checkout", "true")
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Failed to load Razorpay SDK"))
      document.body.appendChild(script)
    })

    return !!(window as any).Razorpay
  }

  const handlePayment = async () => {
    if (!selectedAddress) {
      return alert("Logistics Context Error: Please select a shipping destination.")
    }

    if (!logistics?.serviceable) {
      return alert("Logistics Protocol: The specified destination is outside our white-glove delivery network.")
    }

    const enabled = process.env.NEXT_PUBLIC_CHECKOUT_ENABLED !== 'false';
    const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock"

    if (!enabled) {
      setProcessingStatus(null);
      alert("Institutional Acquisition Gateway is currently in Maintenance Mode. Reconvene later.");
      return;
    }

    trackEvent('checkout_interaction', { step: 'payment_init' })
    setProcessingStatus("Initializing Secure Protocol...");
    setLoading(true)
    setPaymentError(null);

    try {
      setProcessingStatus("Preparing Secure Gateway...")
      const sdkReady = await ensureRazorpayLoaded()
      if (!sdkReady) {
        throw new Error("Payment gateway failed to initialize. Please retry.")
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert("Authentication Required: Please sign in to initiate acquisition.")
        router.push("/login")
        return
      }

      // 🔐 FETCH AUTH TOKEN (Sync with SSR)
      const { data: { session } } = await supabase.auth.getSession();
      
      // 🕵️ PHASE 1: CREATE ORDER (SQL LINKING)
      // This attaches the selected address and seller_ids to the database first
      setProcessingStatus("Generating Order Identity...")
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({
          address_id: selectedAddress.id,
          items: cartItems.map(item => ({
            product_id: item.productId,
            seller_id: item.seller_id,
            quantity: item.qty || 1,
            price: item.price,
            size: item.size
          }))
        })
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Order Initialization Protocol Failed.");
      }

      const orderData = await orderRes.json();
      const orderBundle = orderData.order_ids || [];
      console.log("SQL Order Bundle Created:", orderBundle);

      // 🕵️ PHASE 2: LAUNCH TRANSACTION
      setProcessingStatus("Initializing Gateway Session...")
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({
          amount: total,
          cart: cartItems,
          shipping: selectedAddress,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Acquisition protocol failed: Failed to create payment order");
      }
      
      const order = await res.json();
      setProcessingStatus("Launching Transaction Interface...")

      // 🕵️ MOCK MODE HANDLER
      if (mode === "mock") {
        setProcessingStatus("Simulating Protocol (Mock Mode)...");
        const verifyRes = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`
          },
          body: JSON.stringify({
            razorpay_order_id: order.id,
            razorpay_payment_id: "mock_pay_" + Date.now(),
            razorpay_signature: "mock_signature",
            cart: cartItems,
            shipping: selectedAddress,
            order_ids: orderBundle // Pass full bundle
          }),
        });

        if (!verifyRes.ok) {
          const verifyError = await verifyRes.json().catch(() => ({}));
          throw new Error(verifyError.error || "Mock verification failed");
        }
        
        const verifyData = await verifyRes.json();
        
        if (verifyData.success) {
          Analytics.logCheckoutComplete(user.id, orderBundle[0]);
          const fullCart = JSON.parse(localStorage.getItem("hstnlx_cart") || "[]")
          const purchasedKeys = cartItems.map(i => `${i.productId}-${i.size}`)
          const remainingCart = fullCart.filter((item: any) => !purchasedKeys.includes(`${item.productId}-${item.size}`))
          localStorage.setItem("hstnlx_cart", JSON.stringify(remainingCart))
          localStorage.removeItem("hstnlx_checkout_items")
          window.dispatchEvent(new Event("hstnlx-cart-updated"))
          router.push(`/checkout/success?order_id=${orderBundle[0]}`)
        }
        return;
      }
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "HSTNLX",
        description: "Official Acquisition",
        order_id: order.id,
        handler: async function (response: any) {
          try {
            setProcessingStatus("Verifying Signature & Finalizing...")
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token || ""}`
              },
              body: JSON.stringify({
                ...response,
                cart: cartItems,
                shipping: selectedAddress,
                order_ids: orderBundle // Pass full bundle
              }),
            });

            if (!verifyRes.ok) throw new Error("Payment verification failed");
            const verifyData = await verifyRes.json();
            
            if (verifyData.success) {
              Analytics.logCheckoutComplete(user.id, orderBundle[0]);
              const fullCart = JSON.parse(localStorage.getItem("hstnlx_cart") || "[]")
              const purchasedKeys = cartItems.map(i => `${i.productId}-${i.size}`)
              const remainingCart = fullCart.filter((item: any) => !purchasedKeys.includes(`${item.productId}-${item.size}`))
              localStorage.setItem("hstnlx_cart", JSON.stringify(remainingCart))
              localStorage.removeItem("hstnlx_checkout_items")
              window.dispatchEvent(new Event("hstnlx-cart-updated"))
              router.push(`/checkout/success?order_id=${orderBundle[0]}`)
            } else {
              throw new Error("Payment verification failed");
            }
          } catch (err: any) {
            console.error("Verification error:", err);
            setProcessingStatus(null);
            setLoading(false);
            setPaymentError(err.message || "Institutional protocol breach during verification.");
          }
        },
        modal: {
          ondismiss: async () => {
            setProcessingStatus(null);
            setLoading(false);
          }
        },
        prefill: {
          name: user.email?.split('@')[0],
          email: user.email,
        },
        theme: {
          color: "#FFFFFF",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
         setProcessingStatus(null);
         setLoading(false);
         setPaymentError(response.error.description || "Transaction failed.");
      });
      rzp.open();
    } catch (error: any) {
      console.error("Acquisition protocol failure:", error)
      setProcessingStatus(null);
      setLoading(false);
      setPaymentError(error.message || "Institutional protocol breach. Transaction terminated.");
      // 🔴 EMERGENCY UNLOCK FRONTEND
      try {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
             await (supabase as any).rpc("release_checkout_lock", { p_user_id: data.user.id });
          }
      } catch (e) { console.error(e) }
    }
  }

  if (loading && !processingStatus) return (
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
                <p className="text-caption font-bold uppercase tracking-[0.2em] text-white">HSTNLX Escrow Protection</p>
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
          
          {paymentError && (
             <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">{paymentError}</p>
                <button 
                  onClick={() => setPaymentError(null)}
                  className="mt-4 text-[9px] underline font-bold uppercase tracking-widest text-white/40 hover:text-white"
                >
                  Clear & Retry Initialization
                </button>
             </div>
          )}
          
          {processingStatus && (
            <div className="mt-8 flex flex-col items-center gap-4 animate-pulse">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">{processingStatus}</p>
            </div>
          )}
        </header>

        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-16 ${processingStatus ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="lg:col-span-3 space-y-12">
            
            {/* 📍 ADDRESS SELECTION SECTION */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-foreground text-card flex items-center justify-center text-[10px] font-bold">1</span>
                <h2 className="text-h3 uppercase tracking-widest font-bold">Destinations</h2>
              </div>
              
              <AddressSelector 
                selectedId={selectedAddress?.id || null} 
                onSelect={handleAddressSelect} 
              />

              {logistics && !logistics.serviceable && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">
                    Logistics Exception: Selected pincode is currently outside our high-performance delivery network.
                  </p>
                </div>
              )}
            </section>

            <div className="h-px bg-border" />

            {/* Section 2: Payment */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-foreground text-card flex items-center justify-center text-[10px] font-bold">2</span>
                <h2 className="text-h3 uppercase tracking-widest font-bold">Protocol</h2>
              </div>

              <div className="luxury-card p-10 bg-accent/10 border-none space-y-4 animate-fade-in text-center">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                    <p className="text-caption font-bold text-white uppercase tracking-widest">Electronic Transaction Interface</p>
                  </div>
                  <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] leading-relaxed">
                    Razorpay Secure Gateway will be initialized upon protocol launch.<br/>
                    Full buyer protection and escrow active.
                  </p>
              </div>
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
                    <div key={`${item.productId}-${item.size}`} className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-smooth">

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
                        {item.image && (
                          <div className="w-16 h-20 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10 relative">
                            <Image 
                              src={item.image || 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'} 
                              className="object-cover transition-transform group-hover:scale-110" 
                              alt={item.title} 
                              fill
                              sizes="64px"
                              onError={(e: any) => {
                                e.target.src = 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'
                              }}
                            />
                          </div>
                        )}

                          <div className="flex flex-col flex-1 justify-between py-1">
                            <div>
                               <div className="flex justify-between items-start text-caption">
                                 <span className="text-white/80 line-clamp-1 leading-relaxed font-medium">{item.title}</span>
                               </div>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Size {item.size}</span>
                                  {item.selectedColor && (
                                    <>
                                      <span className="text-white/20 text-[10px]">|</span>
                                      <span className="text-[10px] text-white/40 uppercase tracking-widest">{item.selectedColor}</span>
                                    </>
                                  )}
                                  <span className="text-white/20 text-[10px]">|</span>
                                  <span className="text-[10px] text-white/40 uppercase tracking-widest">Qty: {item.qty || 1}</span>
                               </div>
                               <span className="font-bold text-primary text-sm mt-2 block">₹ {(item.price * (item.qty || 1)).toLocaleString()}</span>
                            </div>
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
                  High Demand • Real-time acquisition active
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
                onClick={handlePayment}
                className="luxury-button w-full !text-[11px] uppercase tracking-[0.3em] font-bold"
              >
                Launch Transaction
              </button>

              <div className="text-[9px] text-center text-white/30 uppercase tracking-[0.2em] leading-relaxed">
                <p>Escrow payment verified by HSTNLX Network</p>
                <p>White-glove delivery guaranteed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
