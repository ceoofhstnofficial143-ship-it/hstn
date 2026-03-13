"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import ProductCard from "@/components/ProductCard"

export default function ProductsPage() {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [category, setCategory] = useState("All")
    const [page, setPage] = useState(0)
    const [categories, setCategories] = useState<string[]>(["All"])

    const loadCategories = async () => {
        const { data } = await supabase
            .from("products")
            .select("category")
            .eq("admin_status", "approved")

        if (data) {
            const uniqueCategories = [...new Set(data.map(p => p.category).filter(Boolean))]
            setCategories(["All", ...uniqueCategories.sort()])
        }
    }

    const observer = useRef<IntersectionObserver | null>(null)

    const loadProducts = async (append = false) => {
        setLoading(true)
        let query = supabase
            .from("products")
            .select("*")
            .eq("admin_status", "approved")

        if (category !== "All") {
            query = query.eq("category", category)
        }

        const start = page * 20
        const end = start + 19
        const { data } = await query.order("created_at", { ascending: false }).range(start, end)

        if (append) {
            setProducts(prev => [...prev, ...(data || [])])
        } else {
            setProducts(data || [])
        }
        setLoading(false)
    }

    const lastProductRef = useCallback((node: HTMLElement | null) => {
        if (loading) return
        if (observer.current) observer.current.disconnect()
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !loading) {
                setPage(prev => prev + 1)
            }
        })
        if (node) observer.current.observe(node)
    }, []) // Remove loading dependency to prevent unnecessary re-creations

    useEffect(() => {
        loadProducts()
    }, [])

    useEffect(() => {
        if (page > 0) loadProducts(true)
    }, [page])

    useEffect(() => {
        setPage(0)
        loadProducts()
    }, [category])

    if (loading && products.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
                            <div className="aspect-square bg-gray-200"></div>
                            <div className="p-4 space-y-2">
                                <div className="h-4 bg-gray-200 rounded"></div>
                                <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
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

                {/* Categories */}
                <div className="mb-12">
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-5 py-2 rounded-full text-sm font-semibold border flex-shrink-0 ${
                                    category === cat
                                        ? "bg-black text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map((product, i) => {
                        if (products.length === i + 1) {
                            return <div ref={lastProductRef} key={product.id}><ProductCard product={product} /></div>
                        }
                        return <ProductCard key={product.id} product={product} />
                    })}
                </div>

                {/* Load More Indicator */}
                {loading && products.length > 0 && (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </>
    )
}
