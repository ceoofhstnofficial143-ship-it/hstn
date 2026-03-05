"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function PayoutsPage() {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingEscrow: 0,
        availablePayout: 0
    })
    const [trustScore, setTrustScore] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchFinances = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get trust score
            const { data: trustData } = await supabase
                .from("trust_scores")
                .select("score")
                .eq("user_id", user.id)
                .single()
            if (trustData) setTrustScore(trustData.score)

            // Get seller products and orders
            const { data: products } = await supabase.from("products").select("id").eq("user_id", user.id)
            if (products) {
                const ids = products.map(p => p.id)
                const { data: orders } = await supabase
                    .from("orders")
                    .select("*, products(price)")
                    .in("product_id", ids)

                if (orders) {
                    const total = orders.reduce((acc, o) => acc + (o.products?.price || 0), 0)
                    const pending = orders.filter(o => o.status !== 'delivered').reduce((acc, o) => acc + (o.products?.price || 0), 0)
                    const available = orders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + (o.products?.price || 0), 0)

                    setStats({
                        totalRevenue: total,
                        pendingEscrow: pending,
                        availablePayout: available
                    })
                }
            }
            setLoading(false)
        }
        fetchFinances()
    }, [])

    const getPayoutReleaseTime = () => {
        if (trustScore >= 70) return "Instant"
        if (trustScore >= 30) return "24 Hours"
        return "7 Days"
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    return (
        <main className="bg-background min-h-screen animate-fade-in py-20 pb-40">
            <div className="section-container max-w-4xl">
                <header className="mb-16">
                    <Link href="/seller/dashboard" className="text-caption uppercase tracking-widest font-bold text-primary hover:opacity-70 transition-smooth mb-12 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-display mt-2">Treasury & Ledger</h1>
                    <p className="text-body text-muted mt-4">Manage your earnings through our secure escrow-protected network.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <div className="luxury-card p-12 bg-foreground text-background border-none relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <p className="text-caption uppercase tracking-widest text-primary font-bold mb-4">Liquid Assets</p>
                        <p className="text-display mb-2">₹ {stats.availablePayout.toLocaleString()}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-12">Tier: {trustScore >= 50 ? 'Elite' : 'Standard'} Verified Seller</p>
                        <button className="luxury-button w-full !bg-white !text-black border-none !py-4 transition-smooth hover:!bg-primary hover:!text-white">
                            Initiate Payout
                        </button>
                    </div>

                    <div className="space-y-8">
                        <div className="luxury-card p-10 bg-accent/20 border-none">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-caption uppercase tracking-widest text-muted font-bold">Escrow Ledger</p>
                                <div className="px-3 py-1 bg-primary/10 rounded-full text-[9px] text-primary font-bold uppercase tracking-widest">
                                    Release: {getPayoutReleaseTime()}
                                </div>
                            </div>
                            <p className="text-h2 font-bold text-foreground">₹ {stats.pendingEscrow.toLocaleString()}</p>
                            <p className="text-[10px] mt-6 leading-relaxed text-muted uppercase tracking-widest font-medium">
                                {trustScore < 50 ? "Increase Trust Score to 50 for faster payout release" : "Escrow release optimized for Elite Status"}
                            </p>
                        </div>
                        <div className="luxury-card p-10 bg-accent/10 border-none flex justify-between items-center">
                            <div>
                                <p className="text-caption uppercase tracking-widest text-muted font-bold mb-1">Vault Portfolio</p>
                                <p className="text-h3 font-bold text-primary">₹ {stats.totalRevenue.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-caption uppercase tracking-widest text-muted font-bold mb-1">Index Score</p>
                                <p className="text-h3 font-bold">{trustScore}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <section>
                    <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
                        <h2 className="text-h3 font-bold uppercase tracking-widest">Protocol Audit</h2>
                        <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Authenticated Documents</span>
                    </div>
                    <div className="space-y-4">
                        <div className="luxury-card p-6 flex justify-between items-center bg-accent/10 border-none group hover:bg-accent/20 transition-smooth">
                            <div className="flex gap-6 items-center">
                                <span className="text-2xl grayscale group-hover:grayscale-0 transition-smooth">📑</span>
                                <div>
                                    <p className="text-body font-bold text-foreground">Government Identification</p>
                                    <p className="text-caption text-muted">Awaiting financial review • 48h SLA</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Syncing</span>
                            </div>
                        </div>
                        <div className="luxury-card p-6 flex justify-between items-center bg-green-500/5 border-green-500/10 group hover:bg-green-500/10 transition-smooth">
                            <div className="flex gap-6 items-center">
                                <span className="text-2xl grayscale group-hover:grayscale-0 transition-smooth">🏦</span>
                                <div>
                                    <p className="text-body font-bold text-foreground">Escrow Payout Destination</p>
                                    <p className="text-caption text-green-700">Verified & Secure Channel Active</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-green-600">Active</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
