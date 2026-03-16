"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import ProductCard from "./ProductCard"
import ProductSkeleton from "./ProductSkeleton"

interface DiscoveryFeedProps {
    userId?: string
    userStyles?: string[]
}

export default function DiscoveryFeed({ userId, userStyles }: DiscoveryFeedProps) {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const pageSize = 10
    const observer = useRef<IntersectionObserver | null>(null)

    const fetchFeed = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setIsLoadingMore(true)
        else setLoading(true)

        const currentPage = isLoadMore ? page + 1 : 0
        const offset = currentPage * pageSize

        try {
            // Use RPC for personalized ranking if user is logged in
            let data: any[] | null = []
            
            if (userId) {
                const { data: feedData, error } = await supabase.rpc("get_personalized_feed", {
                    p_viewer_id: userId,
                    p_limit: pageSize,
                    p_offset: offset
                })
                if (error) throw error
                data = feedData
            } else {
                const { data: anonData, error } = await supabase
                    .from("products")
                    .select("*, profiles!products_user_id_fkey(username), trust_scores(score)")
                    .eq("admin_status", "approved")
                    .order("created_at", { ascending: false })
                    .range(offset, offset + pageSize - 1)
                if (error) throw error
                data = anonData
            }

            if (!data || data.length < pageSize) setHasMore(false)
            
            if (isLoadMore) {
                setProducts(prev => [...prev, ...data!])
                setPage(currentPage)
            } else {
                setProducts(data || [])
            }
        } catch (error) {
            console.error("Feed Protocol Error:", error)
        } finally {
            setLoading(false)
            setIsLoadingMore(false)
        }
    }, [userId, page])

    const sortedProducts = [...products].sort((a, b) => {
        if (!userStyles || userStyles.length === 0) return 0
        const aMatch = a.style_tags?.some((tag: string) => userStyles.includes(tag))
        const bMatch = b.style_tags?.some((tag: string) => userStyles.includes(tag))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return 0
    })

    useEffect(() => {
        fetchFeed()
    }, [userId])

    const lastElementRef = useCallback((node: any) => {
        if (loading || isLoadingMore) return
        if (observer.current) observer.current.disconnect()
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchFeed(true)
            }
        })
        
        if (node) observer.current.observe(node)
    }, [loading, isLoadingMore, hasMore, fetchFeed])

    return (
        <div className="space-y-12">
            <header className="flex items-end justify-between border-b border-gray-100 pb-8">
                <div>
                   <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">The Matrix</span>
                   <h2 className="text-display mt-2 italic text-h1 uppercase tracking-tighter">Discovery Feed</h2>
                </div>
                <div className="hidden md:block">
                   <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Personalized for you</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {sortedProducts.map((product, index) => (
                    <div 
                        key={`${product.id}-${index}`} 
                        ref={index === products.length - 1 ? lastElementRef : null}
                        className="animate-fade-in"
                    >
                        <ProductCard product={product} />
                        
                        {/* Feed Engagement Layer */}
                        <div className="mt-6 flex items-center justify-between px-4">
                            <div className="flex items-center gap-4">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Verified Asset</span>
                                {product.style_tags?.some((tag: string) => userStyles?.includes(tag)) && (
                                    <span className="ml-4 px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase tracking-tighter rounded-sm animate-bounce">Aesthetic Match</span>
                                )}
                            </div>
                            <div className="h-px flex-1 mx-8 bg-gray-100" />
                            <div className="flex gap-4">
                               <button className="text-lg opacity-40 hover:opacity-100 transition-opacity">💬</button>
                               <button className="text-lg opacity-40 hover:opacity-100 transition-opacity">📤</button>
                            </div>
                        </div>
                    </div>
                ))}

                {(loading || isLoadingMore) && (
                    <>
                        <ProductSkeleton />
                        <ProductSkeleton />
                    </>
                )}
            </div>

            {!hasMore && products.length > 0 && (
                <div className="py-20 text-center">
                    <div className="w-12 h-px bg-gray-100 mx-auto mb-8" />
                    <p className="text-caption text-muted uppercase tracking-[0.3em] font-medium">End of Archive</p>
                </div>
            )}
        </div>
    )
}
