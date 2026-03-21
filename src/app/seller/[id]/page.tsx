"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import ProductCard from "@/components/ProductCard"

export default function SellerPage() {
    const params = useParams()
    const id = params?.id as string

    const [seller, setSeller] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [trust, setTrust] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [totalOrders, setTotalOrders] = useState(0)
    const [totalRevenue, setTotalRevenue] = useState(0)
    const [displayScore, setDisplayScore] = useState(0)

    useEffect(() => {
        if (id) {
            fetchSellerData()
        }
    }, [id])

    useEffect(() => {
        if (trust?.score) {
            let start = 0
            const end = trust.score
            const duration = 1500
            const increment = end / (duration / 16)

            const timer = setInterval(() => {
                start += increment
                if (start >= end) {
                    setDisplayScore(end)
                    clearInterval(timer)
                } else {
                    setDisplayScore(Math.floor(start))
                }
            }, 16)
            return () => clearInterval(timer)
        }
    }, [trust?.score])

    const fetchSellerData = async () => {
        setLoading(true)

        // 1. Fetch Seller Profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", id)
            .maybeSingle()

        if (profile) {
            setSeller(profile)
        } else {
            // Fallback for sellers without a formal profile record
            setSeller({
                username: `merchant_${id.slice(0, 5)}`,
                id: id
            })
        }

        // 2. Fetch Seller's Trust Score
        const { data: trustData } = await supabase
            .from("trust_scores")
            .select("score, verified")
            .eq("user_id", id)
            .maybeSingle()

        setTrust(trustData || { score: 50, verified: false })

        // 3. Fetch Seller's Products
        const { data: productsData } = await supabase
            .from("products")
            .select("*")
            .eq("user_id", id)
            .order("created_at", { ascending: false })

        if (productsData) setProducts(productsData)

        // 4. Fetch Analytics (Delivered Orders)
        const { data: analyticsData } = await supabase
            .from("orders")
            .select("status, product_id, products(price)")
            .eq("seller_id", id)
            .eq("status", "delivered")

        if (analyticsData) {
            setTotalOrders(analyticsData.length)
            const revenue = analyticsData.reduce((sum: number, order: any) => {
                return sum + (order.products?.price || 0)
            }, 0)
            setTotalRevenue(revenue)
        }

        setLoading(false)
    }

    if (loading) return <div className="p-10 text-center">Loading seller profile...</div>
    if (!seller) return <div className="p-10 text-center">Seller not found.</div>

    return (
        <div className="section-container py-12">
            <Link href="/" className="inline-flex items-center gap-2 text-caption uppercase tracking-[0.2em] font-bold hover:text-primary transition-smooth mb-12">
                ← Discovery Feed
            </Link>

            {/* INSTITUTIONAL HEADER */}
            <div className="luxury-card bg-white border-none shadow-2xl overflow-hidden mb-20 relative group">
                {/* Elite Banner */}
                <div className="h-48 w-full bg-gradient-to-r from-[#F7F3EB] via-white to-[#F7F3EB] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 animate-light-sweep bg-gradient-to-r from-transparent via-primary to-transparent" />
                </div>

                <div className="p-10 -mt-24 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
                        <div className="w-40 h-40 rounded-full bg-white p-2 shadow-2xl border-4 border-primary ring-4 ring-white relative group-hover:scale-105 transition-smooth">
                            <div className="w-full h-full rounded-full bg-foreground flex items-center justify-center text-primary text-display text-4xl">
                                {seller.username?.[0]?.toUpperCase()}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-primary text-black p-2 rounded-full shadow-lg border-2 border-white">
                                <span className="text-sm">🛡️</span>
                            </div>
                        </div>

                        <div className="text-center md:text-left">
                            <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                                <h1 className="text-h1 lowercase tracking-tighter">@{seller.username}</h1>
                                <div className="px-4 py-1.5 bg-primary/10 rounded-full border border-primary/30">
                                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">
                                        {trust?.score >= 150 ? "Elite Merchant 🚀" :
                                            trust?.score >= 100 ? "Gold Certified ⚜️" :
                                                trust?.score >= 50 ? "Verified Tier ✅" : "Standard Seller"}
                                    </span>
                                </div>
                            </div>
                            <p className="text-caption uppercase tracking-[0.3em] text-muted font-bold italic">
                                Protocol Member Since Feb 2026
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 bg-foreground text-card p-10 rounded-3xl shadow-3xl group/plate relative overflow-hidden">
                        <div className="absolute inset-0 opacity-5 group-hover/plate:opacity-10 transition-smooth translate-x-12 translate-y-12">
                            <span className="text-8xl">🛡️</span>
                        </div>
                        <div className="text-center relative z-10">
                            <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em] mb-4">HSTNLX Trust Index™</p>
                            <div className="flex items-end justify-center gap-2">
                                <span className="text-6xl font-light tracking-tighter text-white leading-none">{displayScore}</span>
                                <span className="text-xl text-white/30 pb-1">/ 100</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SELLER ANALYTICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-24">
                <div className="luxury-card p-10 group bg-accent/10 border-none shadow-xl hover-lift">
                    <p className="text-display text-4xl text-foreground mb-2">{products.length}</p>
                    <p className="text-caption uppercase tracking-[0.2em] font-bold">Active Assets</p>
                </div>

                <div className="luxury-card p-10 group bg-accent/10 border-none shadow-xl hover-lift">
                    <p className="text-display text-4xl text-foreground mb-2">{totalOrders}</p>
                    <p className="text-caption uppercase tracking-[0.2em] font-bold">Protocol Confirmations</p>
                </div>

                <div className="luxury-card p-10 group bg-foreground text-card border-none shadow-2xl hover-lift">
                    <p className="text-display text-4xl text-primary mb-2">₹{totalRevenue.toLocaleString()}</p>
                    <p className="text-caption uppercase tracking-[0.2em] font-bold text-white/40">Secured Liquidity</p>
                </div>
            </div>

            <div className="mb-12 border-b border-border pb-8">
                <h2 className="text-h2">The Managed Collection</h2>
            </div>

            {products.length === 0 ? (
                <div className="text-center py-40 bg-accent/5 rounded-[48px] border-2 border-dashed border-primary/20">
                    <p className="text-caption uppercase tracking-widest font-bold text-muted">Awaiting the next curated release</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                    {products.map((product: any) => (
                        <ProductCard key={product.id} product={{ ...product, trust }} />
                    ))}
                </div>
            )}
        </div>
    )
}
