"use client"

import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import ProductCard from "@/components/ProductCard"

interface DiscoveryFeedProps {
    userId?: string
    userStyles?: string[]
}

export default function DiscoveryFeed({ userId, userStyles }: DiscoveryFeedProps) {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const pageSize = 20

    const loadMoreProducts = useCallback(async () => {
        if (loadingMore || !hasMore) return

        setLoadingMore(true)
        const start = page * pageSize
        const end = start + pageSize - 1

        try {
            let query = supabase
                .from("products")
                .select(`
                    *,
                    profiles!products_user_id_fkey(username)
                `)
                .eq("admin_status", "approved")

            // V2: Interest-Graph Discovery
            // If user has preferred styles, boost those categories
            if (userStyles && userStyles.length > 0) {
                // In a real pgvector setup, we'd use a similarity RPC
                // For now, we simulate "Interest-Graph" by prioritising user styles
                query = query.in("category", userStyles)
            }

            const { data, error } = await query
                .order("created_at", { ascending: false })
                .range(start, end)

            if (error) throw error

            if (data && data.length > 0) {
                setProducts(prev => [...prev, ...data])
                setPage(currentPage => currentPage + 1)
                setHasMore(data.length === pageSize)
            } else {
                // If we found nothing with filters, try loading general products
                if (userStyles && userStyles.length > 0) {
                    const { data: generalData } = await supabase
                        .from("products")
                        .select(`*, profiles!products_user_id_fkey(username)`)
                        .eq("admin_status", "approved")
                        .order("created_at", { ascending: false })
                        .range(start, end)
                    
                    if (generalData && generalData.length > 0) {
                        setProducts(prev => [...prev, ...generalData])
                        setPage(currentPage => currentPage + 1)
                        setHasMore(generalData.length === pageSize)
                        return
                    }
                }
                setHasMore(false)
            }
        } catch (error) {
            console.error("Error loading more products:", error)
            setHasMore(false)
        } finally {
            setLoadingMore(false)
        }
    }, [page, loadingMore, hasMore, pageSize, userStyles])

    useEffect(() => {
        setProducts([])
        setPage(0)
        setHasMore(true)
        loadMoreProducts()
    }, [userStyles])

    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
                loadMoreProducts()
            }
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [loadMoreProducts])

    if (loading && products.length === 0) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div className="text-center px-4">
                    <div className="h-10 w-48 bg-gray-100 rounded-xl mx-auto mb-4 animate-pulse"></div>
                    <div className="h-4 w-64 bg-gray-50 rounded-lg mx-auto animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 px-4 lg:px-0">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="relative aspect-[3/4] md:aspect-square bg-gray-100 rounded-[2rem] animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 lg:space-y-12 animate-fade-in">
            <div className="text-center px-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Discovery Protocol</span>
                <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter mt-2 italic">
                    {userId ? "Personalized Feed" : "Global Archive"}
                </h1>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4">
                    {userId ? "Synchronized with your Aesthetic DNA" : "Real-time high-velocity fashion drops"}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 px-4 lg:px-0">
                {products.map((product, index) => (
                    <ProductCard
                        key={`${product.id}-${index}`}
                        product={product}
                        fullScreen={true}
                    />
                ))}
            </div>

            {loadingMore && (
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
                </div>
            )}

            {!hasMore && products.length > 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500">You've seen all the latest drops! Check back soon for more.</p>
                </div>
            )}

            {products.length === 0 && !loading && (
                <div className="text-center py-12">
                    <p className="text-gray-600">No products found. Check back soon!</p>
                </div>
            )}
        </div>
    )
}
