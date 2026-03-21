"use client"

import { useEffect, useState, use } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default function DisputeProtocol({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [order, setOrder] = useState<any>(null)
    const [reason, setReason] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const fetchOrder = async () => {
            const { data } = await supabase
                .from("orders")
                .select(`
                    *,
                    order_items (
                        *,
                        products (*)
                    )
                `)
                .eq("id", id)
                .single()
            setOrder(data)
            setLoading(false)
        }
        fetchOrder()
    }, [id])

    const handleSubmitDispute = async () => {
        if (!reason) return alert("Dispute reason required for protocol initialization.")
        setSubmitting(true)

        // 🛡️ HARDENED PROTOCOL: RPC call instead of manual table write
        const { error } = await supabase.rpc("initialize_order_dispute", {
            p_order_id: id,
            p_reason: reason,
            p_details: "Consumer initiated via Institutional Interface V1.1"
        })

        if (error) {
            alert(`Dispute Protocol Failure: ${error.message}`)
            setSubmitting(false)
        } else {
            alert("Dispute Protocol Initialized. Escrow funds frozen.")
            router.push("/orders")
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    return (
        <main className="bg-background min-h-screen animate-fade-in py-20 pb-40">
            <div className="section-container max-w-2xl">
                <header className="mb-16">
                    <span className="text-caption uppercase tracking-[0.4em] text-red-500 font-black">Escrow Protection Active</span>
                    <h1 className="text-display mt-2 italic uppercase tracking-tighter">Initialize Dispute Protocol</h1>
                    <p className="text-[10px] text-muted uppercase tracking-widest mt-4">Record: Order #{id?.slice(0, 8)}</p>
                </header>

                <div className="luxury-card p-12 bg-white shadow-2xl border-none space-y-12">
                    <div className="flex gap-8 items-center bg-accent/5 p-6 rounded-3xl">
                        <div className="w-20 h-20 bg-black rounded-2xl overflow-hidden relative">
                            {order?.order_items?.[0]?.products?.image_url && (
                                <Image src={order.order_items[0].products.image_url} alt="asset" fill className="object-cover" />
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-tight">{order?.order_items?.[0]?.products?.title}</p>
                            <p className="text-[9px] text-muted uppercase tracking-widest font-bold mt-1">Valuation: ₹ {order?.total_price?.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-foreground">Evidence of Protocol Breach</label>
                        <textarea 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe how the physical asset deviates from the motion capture / institutional description..."
                            className="w-full h-48 bg-accent/20 border-none rounded-3xl px-8 py-6 text-body outline-none focus:ring-1 ring-red-500 transition-smooth resize-none"
                        />
                    </div>

                    <div className="p-8 bg-red-500/5 rounded-3xl border border-red-500/20 flex gap-6 items-start">
                        <span className="text-red-500 text-2xl">⚖️</span>
                        <div>
                            <p className="text-[10px] text-red-700 font-bold uppercase tracking-widest leading-relaxed">By initializing this protocol, you freeze the seller's escrow payout. An institutional arbiter will review the video capture evidence within 48 hours.</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-8 border-t border-border">
                        <Link href="/orders" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted hover:text-foreground">Terminate Request</Link>
                        <button 
                            onClick={handleSubmitDispute}
                            disabled={submitting}
                            className={`luxury-button !py-4 !px-12 !text-[10px] !bg-red-500 !text-white uppercase tracking-[0.3em] font-black ${submitting ? 'opacity-50' : ''}`}
                        >
                            Launch Dispute →
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
