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
    
    // Infinite scroll state
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [preloadedProducts, setPreloadedProducts] = useState<any[]>([])
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const productsPerPage = 12

    const fashionCategories = [
        { name: "All", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop" },
        { name: "Co-ord sets", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1920&auto=format&fit=crop" },
        { name: "Trendy tops", image: "https://images.unsplash.com/photo-1551163943-3f6a855d1153?q=80&w=1887&auto=format&fit=crop" },
        { name: "Casual dresses", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1983&auto=format&fit=crop" },
        { name: "Korean-style fashion", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1887&auto=format&fit=crop" }
    ]

    const fetchProducts = async (currentPage = 0, append = false) => {
        try {
            if (!append) setLoading(true)
            else setIsLoadingMore(true)

            let query = supabase
                .from("products")
                .select(`
                    *,
                    profiles:user_id(username)
                `)
                .eq("admin_status", "approved")
                .order("created_at", { ascending: false })
                .range(currentPage * productsPerPage, (currentPage + 1) * productsPerPage - 1)

            if (category !== "All") {
                query = query.eq("category", category)
            }

            if (searchQuery) {
                query = query.ilike("title", `%${searchQuery}%`)
            }

            const { data, error } = await query

            if (error) throw error

            const newProducts = data || []
            
            if (append) {
                setProducts(prev => [...prev, ...newProducts])
            } else {
                setProducts(newProducts)
            }

            // Check if there are more products to load
            if (newProducts.length < productsPerPage) {
                setHasMore(false)
            }

            // Preload next page for instant experience
            if (newProducts.length === productsPerPage) {
                preloadNextPage(currentPage + 1)
            }

        } catch (error) {
            console.error("Error fetching products:", error)
        } finally {
            setLoading(false)
            setIsLoadingMore(false)
        }
    }

    const preloadNextPage = async (nextPage: number) => {
        try {
            let query = supabase
                .from("products")
                .select(`
                    *,
                    profiles:user_id(username)
                `)
                .eq("admin_status", "approved")
                .order("created_at", { ascending: false })
                .range(nextPage * productsPerPage, (nextPage + 1) * productsPerPage - 1)

            if (category !== "All") {
                query = query.eq("category", category)
            }

            if (searchQuery) {
                query = query.ilike("title", `%${searchQuery}%`)
            }

            const { data } = await query
            setPreloadedProducts(data || [])
        } catch (error) {
            console.log("Preload failed, will load on demand")
        }
    }

    const loadMore = () => {
        if (hasMore && !isLoadingMore) {
            const nextPage = page + 1
            setPage(nextPage)
            
            // Use preloaded data if available
            if (preloadedProducts.length > 0) {
                setProducts(prev => [...prev, ...preloadedProducts])
                setPreloadedProducts([])
                
                // Preload the next page
                if (preloadedProducts.length === productsPerPage) {
                    preloadNextPage(nextPage + 1)
                } else {
                    setHasMore(false)
                }
            } else {
                fetchProducts(nextPage, true)
            }
        }
    }

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0]
                if (target.isIntersecting && hasMore && !isLoadingMore) {
                    loadMore()
                }
            },
            { threshold: 0.1 }
        )

        const sentinel = document.getElementById('scroll-sentinel')
        if (sentinel) observer.observe(sentinel)

        return () => {
            if (sentinel) observer.unobserve(sentinel)
        }
    }, [hasMore, isLoadingMore, page, preloadedProducts])

    // Reset pagination when filters change
    useEffect(() => {
        setPage(0)
        setHasMore(true)
        setPreloadedProducts([])
        fetchProducts(0, false)
    }, [category, searchQuery])

    // Initial load
    useEffect(() => {
        fetchProducts(0, false)
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        HSTN Fashion Marketplace
                    </h1>
                    <p className="text-lg text-gray-600">
                        Discover premium fashion from verified sellers
                    </p>
                </div>

                {/* Search */}
                <div className="mb-8">
                    <input
                        type="text"
                        placeholder="Search fashion items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* Categories */}
                <div className="mb-12">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {fashionCategories.map((cat) => (
                            <button
                                key={cat.name}
                                onClick={() => setCategory(cat.name)}
                                className={`relative h-32 rounded-xl overflow-hidden transition-all ${
                                    category === cat.name ? 'ring-2 ring-primary' : ''
                                }`}
                            >
                                <img
                                    src={cat.image}
                                    alt={cat.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <span className="text-white font-semibold">{cat.name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>

                {/* Load More Indicator */}
                {isLoadingMore && (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                )}

                {/* Scroll Sentinel */}
                <div id="scroll-sentinel" className="h-1" />
            </div>
        </>
    )
}
