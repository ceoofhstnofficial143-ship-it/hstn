"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import Image from "next/image"
import { use } from "react"

export default function OrderTrackingProtocol(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items ( *, products (*) )
        `)
        .eq("id", params.id)
        .single()

      if (!error && data) {
        // Safe secondary fetch for Seller Profile to avoid PostgREST explicit FK errors
        const { data: sellerData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.seller_id)
          .single()

        setOrder({ ...data, seller: sellerData })
      }
      setLoading(false)
    }

    fetchOrder()
  }, [params.id])

  const handleDispute = async () => {
    const reason = prompt("Initialize Dispute Protocol: MISSION CRITICAL\n\nPlease state the primary reason for conflict (e.g., Damaged Asset, Misrepresented Silhouette, Counterfeit Suspicion):")
    if (!reason) return

    const details = prompt("Please provide specific forensic details for the institutional audit:")
    if (!details) return

    if (!confirm("Proceed with Formal Dispute? This will freeze the Merchant's Payout Ledger immediately.")) return

    setLoading(true)
    const { error } = await supabase.rpc('initialize_order_dispute', {
        p_order_id: params.id,
        p_reason: reason,
        p_details: details
    })

    if (error) {
        alert("Dispute Protocol Failure: " + error.message)
    } else {
        alert("Dispute Initialized. The Escrow has been locked. An auditor will contact you shortly.")
        window.location.reload()
    }
    setLoading(false)
  }

  const getTrackingUrl = (provider: string, awb: string) => {
    const p = provider.toLowerCase()
    if (p.includes("delhivery")) return `https://www.delhivery.com/track/package/${awb}`
    if (p.includes("bluedart")) return `https://www.bluedart.com/trackdetails?awb=${awb}`
    if (p.includes("ecom")) return `https://ecomexpress.in/tracking/?awb_field=${awb}`
    if (p.includes("india post")) return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`
    if (p.includes("dtdc")) return `https://www.dtdc.in/tracking/tracking_results.asp?awbNumber=${awb}`
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="text-center">
            <p className="text-[12px] uppercase tracking-[0.4em] font-black text-red-500 mb-4">Protocol Error</p>
            <h1 className="text-4xl italic font-black uppercase tracking-tighter">Record Not Found</h1>
            <Link href="/orders" className="luxury-button !bg-white !text-black mt-8">Return to Terminal</Link>
        </div>
      </div>
    )
  }

  return (
    <main className="bg-background min-h-screen animate-fade-in relative">
      {/* Visual Backdrop */}
      <div className="absolute top-0 left-0 w-full h-64 bg-black z-0 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 pb-40">
        <Link href="/orders" className="text-[10px] text-white/60 hover:text-white uppercase tracking-widest font-black mb-12 inline-flex items-center gap-2 transition-colors">
            ← Return to Hub
        </Link>
        
        <header className="mb-12">
            <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">Logistics Command</span>
            <h1 className="text-4xl md:text-5xl mt-2 italic font-black uppercase tracking-tighter text-white drop-shadow-lg">
                Tracking Protocol
            </h1>
        </header>

        <div className="luxury-card bg-white p-8 md:p-12 border border-border rounded-3xl shadow-2xl space-y-12">
            
            {/* Header Block */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border pb-8">
                <div>
                    <h2 className="text-[10px] uppercase tracking-[0.3em] font-black text-muted mb-2">Immutable Ledger ID</h2>
                    <p className="text-3xl font-mono font-black tracking-tighter">#{order.id.split('-')[0].toUpperCase()}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted mt-2">Valuation: ₹{order.total_price.toLocaleString()}</p>
                </div>
                <div className="text-left md:text-right">
                    <p className="text-[9px] uppercase tracking-[0.3em] font-black text-muted mb-2">Merchant Key</p>
                    <p className="text-sm font-bold uppercase tracking-tight">{order.seller?.full_name || 'Verified Merchant'}</p>
                </div>
            </div>

            {/* Tracking Provider Block (If Shipped) */}
            {order.tracking_provider && order.tracking_number && (
                <div className="bg-accent/5 rounded-2xl p-6 border border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <span className="text-[9px] uppercase tracking-[0.3em] font-black text-primary">Carrier Protocol Established</span>
                        <div className="mt-2 text-xl font-black uppercase tracking-tight">{order.tracking_provider}</div>
                    </div>
                    <div className="text-center sm:text-right">
                        <span className="text-[9px] uppercase tracking-[0.3em] font-black text-muted block mb-1">Waybill Identifier</span>
                        {getTrackingUrl(order.tracking_provider, order.tracking_number) ? (
                          <a 
                            href={getTrackingUrl(order.tracking_provider, order.tracking_number)!} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-primary/10 border border-primary/30 text-primary px-4 py-2 rounded-lg font-mono text-sm font-bold tracking-widest shadow-sm hover:bg-primary hover:text-white transition-all block"
                          >
                            {order.tracking_number} ↗
                          </a>
                        ) : (
                          <div className="bg-white border border-border px-4 py-2 rounded-lg font-mono text-sm font-bold tracking-widest shadow-sm">
                            {order.tracking_number}
                          </div>
                        )}
                    </div>
                </div>
            )}

            {/* Vertical Timeline */}
            <div className="pl-4 md:pl-8">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-muted mb-8">Supply Chain Trajectory</h3>
                <div className="space-y-10 relative">
                    <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-border z-0" />
                    
                    {[
                        { id: 'confirmed', label: 'Protocol Initialized', desc: 'Secure escrow lock achieved. Merchant notified.' },
                        { id: 'packed', label: 'Asset Preparation', desc: 'Quality inspection and secured packaging engaged.' },
                        { id: 'shipped', label: 'Carrier Handover', desc: 'Asset acquired by logistics provider. In transit.' },
                        { id: 'delivered', label: 'Acquisition Complete', desc: 'Asset successfully reached destination coordinates.' }
                    ].map((step, idx) => {
                        const stages = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']
                        const currentIdx = stages.indexOf(order.status || 'pending')
                        const stepIdx = stages.indexOf(step.id)
                        const isPast = currentIdx >= stepIdx
                        const isCurrent = currentIdx === stepIdx

                        return (
                            <div key={step.id} className="relative z-10 flex gap-8 items-start group">
                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 bg-white transition-all duration-700 ${
                                    isCurrent ? 'border-primary ring-4 ring-primary/10 shadow-lg scale-110' : 
                                    isPast ? 'border-black bg-black' : 'border-border'
                                }`}>
                                    {isPast && !isCurrent ? (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-primary animate-pulse' : 'bg-transparent'}`} />
                                    )}
                                </div>
                                <div className={`pt-1 ${!isPast && 'opacity-40'}`}>
                                    <h4 className="text-sm font-black uppercase tracking-widest">{step.label}</h4>
                                    <p className="text-[10px] text-muted tracking-widest mt-1 max-w-sm">{step.desc}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Asset Details */}
            <div className="border-t border-border pt-8 mt-12 block">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-muted mb-6">Secured Assets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {order.order_items?.map((item: any) => (
                        <div key={item.id} className="flex gap-4 p-4 rounded-xl border border-border bg-gray-50/50 hover:bg-white transition-colors">
                            <div className="w-16 h-16 bg-accent/20 rounded-lg overflow-hidden flex-shrink-0 relative">
                                <Image src={item.products?.image_url} alt="Product" fill className="object-cover" sizes="64px" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <p className="text-[10px] font-black uppercase tracking-tight line-clamp-1">{item.products?.title}</p>
                                <p className="text-[9px] uppercase tracking-widest text-muted mt-1">Size {item.selected_size} • Qty {item.quantity}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Delivery Destination */}
            <div className="bg-black text-white p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl">📍</div>
                <div className="relative z-10 w-full md:w-2/3">
                    <span className="text-[9px] uppercase tracking-[0.4em] font-black text-primary mb-4 block">Drop Coordinates</span>
                    <p className="text-sm font-bold uppercase tracking-widest mb-1">{order.shipping_address?.full_name}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-60 leading-relaxed max-w-md">
                        {order.shipping_address?.address}, {order.shipping_address?.city} {order.shipping_address?.pincode}
                    </p>
                </div>
            </div>

            {/* Dispute Engine Protocol */}
            <div className={`p-8 rounded-2xl border transition-all ${order.is_disputed ? 'bg-red-500/5 border-red-500/20' : 'bg-accent/5 border-border shadow-inner'}`}>
                 <header className="flex justify-between items-center mb-6">
                    <div>
                        <span className={`text-[9px] uppercase tracking-[0.4em] font-black mb-1 block ${order.is_disputed ? 'text-red-500' : 'text-muted'}`}>
                            {order.is_disputed ? 'Conflict Protocol Active' : 'Institutional Protection'}
                        </span>
                        <h3 className="text-lg font-black uppercase tracking-tight">Merchant Resolution</h3>
                    </div>
                    {order.is_disputed && (
                        <div className="bg-red-500 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full animate-pulse shadow-lg shadow-red-500/20">
                            Escrow Locked ⚔️
                        </div>
                    )}
                 </header>
                 
                 {order.is_disputed ? (
                     <p className="text-[10px] text-red-500/60 uppercase tracking-widest leading-relaxed max-w-lg font-bold">
                         A formal dispute has been logged for this acquisition. All financial transfers to the merchant have been intercepted. Institutional audit in progress.
                     </p>
                 ) : (
                     <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                         <p className="text-[9px] text-muted uppercase tracking-widest leading-relaxed max-w-xs font-medium">
                             Not as described? Assets damaged? You have 48 hours to trigger the Dispute Protocol before funds are released.
                         </p>
                         {['shipped', 'delivered'].includes(order.status) && (
                            <button 
                                onClick={handleDispute}
                                className="text-[10px] font-black uppercase tracking-widest text-red-500 border-b-2 border-red-500/20 hover:border-red-500 transition-all pb-1"
                            >
                                Initialize Conflict Audit
                            </button>
                         )}
                     </div>
                 )}
            </div>

        </div>
      </div>
    </main>
  )
}
