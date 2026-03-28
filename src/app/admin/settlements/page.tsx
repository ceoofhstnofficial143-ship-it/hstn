"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { NotificationProtocol } from "@/lib/notifications"

export default function PayoutSettlements() {
    const [payouts, setPayouts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const fetchPayouts = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUser(user)

            // Phase 1: Fetch Payouts and Orders (No identity joins)
            const { data, error } = await (supabase as any)
                .from("seller_payouts")
                .select(`
                    *,
                    is_disputed,
                    orders (id, status, created_at)
                `)
                .order("created_at", { ascending: false })

            if (error) {
                console.error("Settlement Query Phase 1 Failure:", error.message);
                alert("Financial Database Protocol Failure: " + error.message);
                setLoading(false);
                return;
            }

            if (data) {
                // Phase 2: Fetch Identity Data (Profiles) for all unique sellers
                const sellerIds = Array.from(new Set(data.filter((p: any) => p.seller_id).map((p: any) => p.seller_id)))
                
                let profileMap: Record<string, any> = {};
                if (sellerIds.length > 0) {
                    const { data: profileData } = await (supabase as any)
                        .from("profiles")
                        .select("id, full_name, email")
                        .in("id", sellerIds);
                    
                    if (profileData) {
                        profileData.forEach((p: any) => profileMap[p.id] = p);
                    }
                }

                // Phase 3: Fetch KYB (UPI) for all sellers
                let kybMap: Record<string, any> = {};
                if (sellerIds.length > 0) {
                    const { data: kybData } = await (supabase as any)
                        .from("seller_kyb")
                        .select("user_id, upi_id, store_name")
                        .in("user_id", sellerIds);
                    
                    if (kybData) {
                        kybData.forEach((k: any) => kybMap[k.user_id] = k);
                    }
                }

                // Phase 4: Consolidate Ledger Data
                const mapped = data.map((p: any) => ({
                    ...p,
                    seller: profileMap[p.seller_id] || { full_name: "Anonymous User", email: p.seller_id },
                    kyb: kybMap[p.seller_id]
                }))
                
                setPayouts(mapped)
            }
            setLoading(false)
        }
        fetchPayouts()
    }, [])

    const handleSettle = async (payoutId: string, amount: number, sellerId: string, upi: string) => {
        if (!confirm(`Initialize Institutional Settlement of ₹${amount.toLocaleString()}?\n\nDestination Protocol: UPI\nMerchant Hub: ${upi || 'N/A'}`)) return

        setLoading(true)
        try {
            const res = await fetch("/api/payout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payout_id: payoutId, amount, seller_id: sellerId })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Integration failure")

            setPayouts(payouts.map(p => p.id === payoutId ? { 
                ...p, 
                status: 'paid', 
                paid_at: new Date().toISOString(),
                settlement_ref: data.payout.settlement_ref 
            } : p))
            
            alert(`Financial Protocol Executed. Transfer ID: ${data.payout.settlement_ref}`)
        } catch (error: any) {
            alert(`Route Protocol Failure: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    return (
        <main className="bg-background min-h-screen animate-fade-in py-20 pb-40">
            <div className="section-container">
                <header className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <span className="text-caption uppercase tracking-widest text-primary font-bold">Admin Protocol</span>
                        <h1 className="text-display mt-2 italic">Settlement Ledger</h1>
                        <p className="text-body text-muted mt-4 max-w-xl">
                            Universal clearing house for platform commissions and merchant liabilities.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <Link href="/admin/disputes" className="luxury-button !py-4 !px-8 !text-[9px] !bg-red-500/10 !border-red-500/20 !text-red-500 hover:!bg-red-500 hover:!text-white uppercase tracking-[0.2em] font-black">
                            Dispute Hub ⚔️
                        </Link>
                        <Link href="/admin/test-rpc" className="luxury-button !py-4 !px-8 !text-[9px] !bg-white/5 !border-white/10 !text-white/40 hover:!text-white uppercase tracking-[0.2em] font-black">
                            Test RPC Hub
                        </Link>
                        <Link href="/admin/merchants" className="luxury-button !py-4 !px-8 !text-[9px] !bg-white/5 !border-white/10 !text-white/40 hover:!text-white uppercase tracking-[0.2em] font-black">
                            Verify Merchants →
                        </Link>
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-8">
                    {payouts.length === 0 ? (
                        <div className="luxury-card p-20 text-center opacity-40 italic">
                            No active payout liabilities detected in the current cycle.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-6 text-[10px] uppercase tracking-widest font-black text-muted">Merchant / Order</th>
                                        <th className="py-6 text-[10px] uppercase tracking-widest font-black text-muted text-center">Protocol Status</th>
                                        <th className="py-6 text-[10px] uppercase tracking-widest font-black text-muted text-right">Revenue</th>
                                        <th className="py-6 text-[10px] uppercase tracking-widest font-black text-muted text-right">Comm (10%)</th>
                                        <th className="py-6 text-[10px] uppercase tracking-widest font-black text-muted text-right">Settlement</th>
                                        <th className="py-6 text-[10px] uppercase tracking-widest font-black text-muted text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {payouts.map((payout) => (
                                        <tr key={payout.id} className="group hover:bg-accent/5 transition-colors">
                                            <td className="py-8">
                                                <div>
                                                    <p className="text-sm font-bold uppercase tracking-tight">{payout.kyb?.store_name || payout.seller?.full_name || 'Anonymous'}</p>
                                                    <p className="text-[10px] text-muted font-mono uppercase mt-1">UPI: {payout.kyb?.upi_id || 'NOT_ONBOARDED'}</p>
                                                    <p className="text-[7px] text-muted font-mono uppercase mt-1">Order: #{payout.orders?.id.slice(0, 8)}</p>
                                                </div>
                                            </td>
                                            <td className="py-8 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                     <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${
                                                        payout.is_disputed ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                                                        payout.status === 'paid' ? 'bg-green-500 text-white border-green-600' : 
                                                        payout.orders?.status === 'delivered' ? 'bg-blue-500 text-white' :
                                                        'bg-black text-white'
                                                    }`}>
                                                        {payout.is_disputed ? 'CONFLICT' : payout.status === 'paid' ? 'SETTLED' : payout.orders?.status}
                                                    </span>
                                                    {payout.orders?.status !== 'delivered' && payout.status !== 'paid' && !payout.is_disputed && (
                                                        <p className="text-[7px] text-muted font-black uppercase tracking-widest">In Escrow</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-8 text-right font-bold text-sm">₹{((payout.amount || 0) + (payout.commission || 0)).toLocaleString()}</td>
                                            <td className="py-8 text-right font-bold text-sm text-primary">₹{(payout.commission || 0).toLocaleString()}</td>
                                            <td className="py-8 text-right font-black text-sm">₹{(payout.amount || 0).toLocaleString()}</td>
                                            <td className="py-8 text-right">
                                                {payout.status === 'pending' && payout.orders?.status === 'delivered' && !payout.is_disputed ? (
                                                    <button 
                                                        onClick={() => handleSettle(payout.id, payout.amount, payout.seller_id, payout.kyb?.upi_id)}
                                                        className="luxury-button !py-2 !px-4 !text-[8px] bg-primary text-white"
                                                    >
                                                        Run Transfer
                                                    </button>
                                                ) : payout.is_disputed ? (
                                                     <span className="text-[9px] text-red-500 font-black uppercase tracking-widest border border-red-500/20 px-4 py-2 rounded-lg bg-red-500/5">
                                                        Case Open ⚔️
                                                     </span>
                                                ) : payout.status === 'paid' ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] text-green-600 font-black uppercase tracking-widest">Completed</span>
                                                        {payout.settlement_ref && <span className="text-[7px] text-muted font-mono tracking-widest uppercase mt-1">Ref: {payout.settlement_ref.slice(0, 10)}</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] text-muted/40 font-black uppercase tracking-widest">Locked</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
