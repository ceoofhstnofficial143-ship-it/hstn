"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getTrustTier } from "@/lib/trustTier"
import SimplePurchaseRequestButton from "./SimplePurchaseRequestButton"

interface ProductCardProps {
    product: {
        id: string
        title: string
        description?: string
        price: number
        image_url?: string
        video_url?: string
        category?: string
        user_id: string
        seller_id: string
        user: {
            username: string
        }
        trust?: {
            score: number
            verified: boolean
        }
    }
}

export default function ProductCard({ product }: ProductCardProps) {
    const router = useRouter()
    const [isWishlisted, setIsWishlisted] = useState(false)
    const [wishlistId, setWishlistId] = useState<string | null>(null)
    const [showVideo, setShowVideo] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const checkWishlist = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from("wishlist")
                .select("id")
                .eq("user_id", user.id)
                .eq("product_id", product.id)
                .single()

            if (data && !error) {
                setIsWishlisted(true)
                setWishlistId(data.id)
            }

            // Set user for purchase button
            setUser(user)
        }
        checkWishlist()

        // Intersection Observer for auto-playing videos
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting)
            },
            { threshold: 0.5 } // Play when 50% visible
        )

        const cardElement = document.getElementById(`product-card-${product.id}`)
        if (cardElement) {
            observer.observe(cardElement)
        }

        return () => {
            if (cardElement) {
                observer.unobserve(cardElement)
            }
        }
    }, [product.id])

    const handleWishlistToggle = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        if (isWishlisted && wishlistId) {
            const { error } = await supabase
                .from("wishlist")
                .delete()
                .eq("id", wishlistId)

            if (!error) {
                setIsWishlisted(false)
                setWishlistId(null)
            }
        } else {
            const { data, error } = await supabase
                .from("wishlist")
                .insert({
                    user_id: user.id,
                    product_id: product.id
                })
                .select("id")
                .single()

            if (data && !error) {
                setIsWishlisted(true)
                setWishlistId(data.id)
            }
        }
    }

    const tier = getTrustTier(product.trust?.score)

    const handleVideoToggle = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!product.video_url) return
        setShowVideo((prev) => !prev)
    }

    return (
        <div id={`product-card-${product.id}`} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden group">
            <Link href={`/products/${product.id}`} className="block">
                {/* Image Container */}
                <div className="relative h-48 overflow-hidden">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-sm">No Image</span>
                        </div>
                    )}

                    {/* Trust Badge */}
                    <div className="absolute top-3 left-3">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${tier.badgeClass}`}>
                            <span>{tier.icon}</span> {tier.label}
                        </div>
                    </div>

                    
                    {/* Wishlist */}
                    <button
                        onClick={handleWishlistToggle}
                        className="absolute bottom-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-md hover:bg-white transition-colors opacity-0 group-hover:opacity-100 lg:opacity-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill={isWishlisted ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className={`w-4 h-4 ${isWishlisted ? "text-red-500 fill-current" : "text-gray-600"}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{product.title}</h3>
                    <p className="text-lg font-bold text-gray-900 mb-2">₹{product.price.toLocaleString()}</p>

                    {/* Trust Score */}
                    <div className="flex items-center gap-1 mb-3">
                        <span className="text-xs text-gray-500">Trust:</span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                            ★ {((product.trust?.score ?? 0) / 20).toFixed(1)}
                        </div>
                    </div>

                    {/* Request Button */}
                    <div onClick={(e) => e.preventDefault()}>
                        <SimplePurchaseRequestButton product={product} />
                    </div>
                </div>
            </Link>
        </div>
    )
}
