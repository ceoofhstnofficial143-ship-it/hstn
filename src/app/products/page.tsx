"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getTrustBoost, getRecencyBoost } from "@/lib/trustTier"
import ProductCard from "@/components/ProductCard"

export default function ProductsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProductsContent />
        </Suspense>
    )
}

function ProductsContent() {
    const searchParams = useSearchParams()
    const initialCategory = searchParams.get("category") || "All"

    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [category, setCategory] = useState(initialCategory)
    const [searchQuery, setSearchQuery] = useState("")

    const fashionCategories = [
        { name: "All", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop" },
        { name: "Co-ord sets", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1920&auto=format&fit=crop" },
        { name: "Trendy tops", image: "https://images.unsplash.com/photo-1551163943-3f6a855d1153?q=80&w=1887&auto=format&fit=crop" },
        { name: "Casual dresses", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1983&auto=format&fit=crop" },
        { name: "Korean-style fashion", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1887&auto=format&fit=crop" }
    ]

    const fetchProducts = async () => {
        let query = supabase
            .from("products")
            .select("*")
            .eq("admin_status", "approved")
            .order("created_at", { ascending: false })

        if (category !== "All") {
            query = query.eq("category", category)
        }

        if (searchQuery) {
            query = query.ilike("title", `%${searchQuery}%`)
        }

        const { data, error } = await query

        if (error) return

        const productsWithTrust = await Promise.all(
            (data ?? []).map(async (product) => {
                const { data: trust } = await supabase
                    .from("trust_scores")
                    .select("score, verified")
                    .eq("user_id", product.user_id)
                    .single()
                
                const { data: sellerData } = await supabase
                    .from("profiles")
                    .select("username, created_at")
                    .eq("id", product.user_id)
                    .single()

                const { data: analytics } = await supabase
                    .from("product_analytics")
                    .select("total_views")
                    .eq("product_id", product.id)
                    .single()

                return { 
                    ...product, 
                    trust,
                    seller_id: product.user_id,
                    user: sellerData,
                    total_views: analytics?.total_views || 0
                }
            })
        )

        // Apply Trust-Based Ranking Algorithm with Liquidity Engine
        // 1. Gold Verified (video_url exists) gets top priority
        // 2. High Trust tiers get secondary priority
        // 3. Recency boost (fresh drops)
        // 4. Liquidity boosts: New sellers (30%), Low views (20%), Low inventory (15%)
        // 5. Raw trust score
        const rankedProducts = productsWithTrust.sort((a, b) => {
            // Priority 1: Gold Verification
            const aVerified = a.video_url ? 1 : 0
            const bVerified = b.video_url ? 1 : 0
            if (aVerified !== bVerified) return bVerified - aVerified

            // Priority 2: Trust Tier Boost
            const aBoost = getTrustBoost(a.trust?.score)
            const bBoost = getTrustBoost(b.trust?.score)
            if (aBoost !== bBoost) return bBoost - aBoost

            // Priority 3: Recency boost
            const aRec = getRecencyBoost(a.created_at)
            const bRec = getRecencyBoost(b.created_at)
            if (aRec !== bRec) return bRec - aRec

            // Priority 4: Liquidity Boosts
            // New seller boost
            const aSellerCreated = new Date(a.user?.created_at || a.created_at)
            const bSellerCreated = new Date(b.user?.created_at || b.created_at)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            const aNewSeller = aSellerCreated > sevenDaysAgo ? 1 : 0
            const bNewSeller = bSellerCreated > sevenDaysAgo ? 1 : 0
            if (aNewSeller !== bNewSeller) return bNewSeller - aNewSeller

            // Low view boost
            const aLowView = a.total_views < 50 ? 1 : 0
            const bLowView = b.total_views < 50 ? 1 : 0
            if (aLowView !== bLowView) return bLowView - aLowView

            // Low inventory boost (if category has <10 products)
            const categoryProducts = productsWithTrust.filter(p => p.category === a.category)
            const aLowInventory = categoryProducts.length < 10 ? 1 : 0
            const bLowInventory = categoryProducts.length < 10 ? 1 : 0
            if (aLowInventory !== bLowInventory) return bLowInventory - aLowInventory

            // Priority 5: Trust Score
            const aScore = a.trust?.score ?? 0
            const bScore = b.trust?.score ?? 0
            if (aScore !== bScore) return bScore - aScore

            // Final tie-breaker: raw created_at
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        setProducts(rankedProducts)
        setLoading(false)
    }

    useEffect(() => {
        fetchProducts()
    }, [category, searchQuery])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <main className="bg-background min-h-screen animate-fade-in py-12 sm:py-20">
            <div className="section-container">
                <header className="mb-12 sm:mb-16 text-center">
                    <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">Find Your Style</span>
                    <h1 className="text-display mt-4">Search Products</h1>

                    <div className="mt-12 max-w-2xl mx-auto relative group">
                        <input
                            type="text"
                            placeholder="Search by product name, category or style..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-accent/20 border-none rounded-full pl-16 pr-10 py-6 text-body outline-none focus:ring-2 ring-primary/30 transition-smooth placeholder:text-muted/60"
                        />
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                    </div>
                </header>

                {/* VISUAL CATEGORY SELECTOR */}
                <div className="flex gap-8 mb-24 overflow-x-auto pb-8 no-scrollbar snap-x px-4">
                    {fashionCategories.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => {
                                setCategory(item.name)
                                setSearchQuery("") // Clear search when picking category
                            }}
                            className="flex flex-col items-center gap-4 group min-w-[120px] snap-center focus:outline-none"
                        >
                            <div className={`w-28 h-28 rounded-full overflow-hidden border-2 transition-smooth p-1 ${category === item.name && !searchQuery ? "border-primary scale-110" : "border-transparent opacity-80 group-hover:opacity-100"
                                }`}>
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </div>
                            <span className={`text-[11px] uppercase tracking-widest font-bold transition-smooth ${category === item.name && !searchQuery ? "text-primary" : "text-muted group-hover:text-foreground"
                                }`}>
                                {item.name}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 sm:mb-12 border-b border-border pb-6">
                    <h2 className="text-h3 font-bold uppercase tracking-widest text-center sm:text-left">
                        {searchQuery ? `Searching for "${searchQuery}"` : category}
                        <span className="text-muted font-normal ml-2">({products.length} Results)</span>
                    </h2>
                    <div className="flex gap-4">
                        {/* Sort or Filter icons could go here */}
                    </div>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-32 luxury-card bg-accent/10 border-none rounded-[48px]">
                        <p className="text-body text-muted uppercase tracking-widest font-medium">Coming soon to the {category} collection</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}
