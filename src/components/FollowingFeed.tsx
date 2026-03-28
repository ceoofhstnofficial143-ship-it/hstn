"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ProductCard from "./ProductCard"
import ProductSkeleton from "./ProductSkeleton"

export default function FollowingFeed() {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            if (user) {
                fetchFollowingProducts(user.id)
            } else {
                setLoading(false)
            }
        }
        checkUser()
    }, [])

    const fetchFollowingProducts = async (userId: string) => {
        try {
            // 1. Get seller IDs that the user follows
            const { data: follows, error: followError } = await (supabase as any)
                .from("follows")
                .select("seller_id")
                .eq("follower_id", userId)
            
            if (followError) throw followError

            if (!follows || follows.length === 0) {
                setProducts([])
                setLoading(false)
                return
            }

            const sellerIds = follows.map((f: any) => f.seller_id)

            // 2. Get recent products from those sellers
            const { data: followingProducts, error: productsError } = await (supabase as any)
                .from("products")
                .select(`
                    id, 
                    title, 
                    price, 
                    image_url, 
                    category, 
                    user_id, 
                    profiles!products_user_id_fkey(username)
                `)
                .in("user_id", sellerIds)
                .eq("admin_status", "approved")
                .order("created_at", { ascending: false })
                .limit(10)

            if (productsError) throw productsError
            setProducts(followingProducts || [])
        } catch (err) {
            console.error("Error fetching following feed:", err)
        } finally {
            setLoading(false)
        }
    }

    if (!user || loading) return null
    if (products.length === 0) return null

    return (
        <section className="mb-12 md:mb-20">
            <div className="flex items-center justify-between mb-6 md:mb-8">
                <div className="flex items-center gap-3 md:gap-4">
                    <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] italic text-purple-600 shrink-0">From Creators You Follow</h2>
                    <div className="h-px w-8 md:w-24 bg-purple-50" />
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-300 shrink-0">New Drops</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </section>
    )
}
