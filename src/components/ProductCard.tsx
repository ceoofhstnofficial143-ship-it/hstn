"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { Analytics } from "@/lib/analytics"
import { trackEvent } from "@/lib/analytics"

interface ProductCardProps {
    product: any
    fullScreen?: boolean
}

export default function ProductCard({ product, fullScreen = false }: ProductCardProps) {
    const [isWishlisted, setIsWishlisted] = React.useState(false)
    const [loadingWishlist, setLoadingWishlist] = React.useState(false)

    React.useEffect(() => {
        const checkWishlistStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await (supabase as any)
                .from("wishlist")
                .select("id")
                .eq("user_id", user.id)
                .eq("product_id", product.id)
                .maybeSingle()

            setIsWishlisted(!!data)
        }
        checkWishlistStatus()

        const handler = () => checkWishlistStatus()
        window.addEventListener("hstnlx-wishlist-updated", handler)
        return () => window.removeEventListener("hstnlx-wishlist-updated", handler)
    }, [product.id])

    const toggleWishlist = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            alert("Authentication Required: Please sign in to secure assets in your vault.")
            return
        }

        setLoadingWishlist(true)
        try {
            if (isWishlisted) {
                const { error } = await (supabase as any)
                    .from("wishlist")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("product_id", product.id)

                if (!error) {
                    setIsWishlisted(false)
                    trackEvent('wishlist_remove', { product_id: product.id, seller_id: product.user_id })
                    window.dispatchEvent(new Event("hstnlx-wishlist-updated"))
                }
            } else {
                const { error } = await (supabase as any)
                    .from("wishlist")
                    .insert([{ user_id: user.id, product_id: product.id }])

                if (!error) {
                    setIsWishlisted(true)
                    Analytics.logWishlistAdd(user.id, product.id, product.user_id)
                    trackEvent('wishlist_add', { product_id: product.id, seller_id: product.user_id })
                    window.dispatchEvent(new Event("hstnlx-wishlist-updated"))
                } else if (error.code === '23505') {
                    setIsWishlisted(true)
                }
            }
        } catch (err) {
            console.error("Wishlist toggle error:", err)
        } finally {
            setLoadingWishlist(false)
        }
    }

    const updateProductViews = async (productId: string) => {
        await (supabase as any)
            .from("products")
            .update({ views: (product.views || 0) + 1 })
            .eq("id", productId);
    }

    const handleProductClick = () => {
        console.log('🖱️ Product clicked:', product.id)
        updateProductViews(product.id)
        trackEvent('product_view', {
            product_id: product.id,
            seller_id: product.user_id,
            category: product.category
        })
    }

    // FullScreen mode for DiscoveryFeed
    if (fullScreen) {
        return (
            <div className="relative w-full h-full bg-black rounded-3xl overflow-hidden">
                {product.video_url ? (
                    <video
                        src={product.video_url}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                    />
                ) : product.image_url ? (
                    <div className="w-full h-full relative">
                        <Image
                            src={product.image_url}
                            alt={product.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No Image</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                    <h3 className="text-lg font-semibold">{product.title}</h3>
                    <p className="text-sm opacity-80">₹{product.price}</p>
                </div>
                <div className="absolute bottom-4 right-4 text-xs text-white opacity-70">
                    Swipe ↑
                </div>

                {/* Discovery Feed Heart Toggle */}
                <div className="absolute top-6 right-6 z-20">
                    <button
                        onClick={toggleWishlist}
                        disabled={loadingWishlist}
                        className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-300 ${isWishlisted ? 'bg-red-500 text-white shadow-xl' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
                    >
                        <span className="text-xl">{isWishlisted ? "❤️" : "🤍"}</span>
                    </button>
                </div>

                <Link href={`/product/${product.id}`} className="absolute inset-0" />
            </div>
        )
    }

    const [showSizes, setShowSizes] = React.useState(false);

    const addToCart = (size: string) => {
        const cart = JSON.parse(localStorage.getItem("hstnlx_cart") || "[]")

        // Check if existing
        const existingIdx = cart.findIndex((i: any) => i.productId === product.id && i.size === size)

        if (existingIdx > -1) {
            cart[existingIdx].qty = (cart[existingIdx].qty || 0) + 1
        } else {
            const newItem = {
                productId: product.id,
                seller_id: product.user_id,
                title: product.title,
                price: product.price,
                image: product.image_url,
                size: size,
                qty: 1
            }
            cart.push(newItem)
        }

        localStorage.setItem("hstnlx_cart", JSON.stringify(cart))
        window.dispatchEvent(new Event("hstnlx-cart-updated"))

        // Track event
        trackEvent('add_to_cart', {
            product_id: product.id,
            seller_id: product.user_id,
            size: size,
            price: product.price
        })

        setShowSizes(false)
        const totalQty = cart[existingIdx > -1 ? existingIdx : cart.length - 1].qty
        alert(`Success: ${product.title} (Size ${size}) secured. Total in bag: ${totalQty}`)
    }

    const hasSecondImage = product.additional_images && product.additional_images.length > 0;
    const mockRating = product.rating || (4.5 + Math.random() * 0.5).toFixed(1);
    const mockSold = Math.floor(Math.random() * 50) + 10;

    return (
        <div className="group bg-white rounded-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 overflow-hidden relative flex flex-col h-full">
            <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                <Link href={`/product/${product.id}`} onClick={handleProductClick} className="block w-full h-full relative">
                    {/* Primary Image */}
                    <Image
                        src={product.image_url || 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className={`object-cover transition-all duration-700 ${hasSecondImage ? 'group-hover:opacity-0' : 'group-hover:scale-110'}`}
                        onError={(e: any) => {
                            e.target.src = 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'
                        }}
                    />

                    {/* Secondary Hover Image */}
                    {hasSecondImage && (
                        <Image
                            src={product.additional_images[0]}
                            alt={`${product.title} alternate view`}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                        />
                    )}

                    {/* TRENDING / DISCOUNT BADGES */}
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start">
                        {product.is_boosted && (
                            <span className="bg-primary text-black px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] animate-pulse">
                                🚀 Discovery Boost
                            </span>
                        )}
                        {(Date.now() - new Date(product.created_at).getTime()) < (24 * 60 * 60 * 1000) && (
                            <span className="bg-blue-600 text-white px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest shadow-2xl">
                                ✨ New Asset
                            </span>
                        )}
                        {(product.views > 50 || product.stock <= 3) && (
                            <span className="bg-black text-white px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest shadow-2xl">
                                {product.stock <= 3 && product.stock > 0 ? '⚡ Limited' : '🔥 Trending'}
                            </span>
                        )}
                        {product.original_price && product.original_price > product.price && (
                            <span className="bg-red-600 text-white px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest shadow-2xl">
                                {Math.round((1 - product.price / product.original_price) * 100)}% OFF
                            </span>
                        )}
                    </div>

                    {/* SCARCITY INDICATOR */}
                    {product.stock > 0 && product.stock <= 3 && (
                        <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-md text-red-600 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-[0.15em] border border-red-100 shadow-xl">
                            Urgent: {product.stock} pieces remaining
                        </div>
                    )}
                </Link>

                {/* Quick Actions overlay on Image */}
                <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 transform translate-x-12 group-hover:translate-x-0 transition-transform duration-500 opacity-0 group-hover:opacity-100">
                    <button
                        onClick={toggleWishlist}
                        disabled={loadingWishlist}
                        className={`backdrop-blur-md p-2.5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white/95 text-gray-400 hover:bg-black hover:text-white'}`}
                    >
                        <span className="text-sm">{isWishlisted ? "❤️" : "🤍"}</span>
                    </button>
                    <Link
                        href={`/product/${product.id}`}
                        className="bg-white/95 backdrop-blur-md p-2.5 rounded-full shadow-2xl hover:bg-black hover:text-white transition-all duration-300 transform hover:scale-110 flex items-center justify-center"
                    >
                        <span className="text-sm">👁️</span>
                    </Link>
                </div>

                {/* Quick Size Selection Overlay */}
                {showSizes && (
                    <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center animate-fade-in">
                        <h4 className="text-white text-[10px] font-black uppercase tracking-[0.3em] mb-6">Select Protocol Size</h4>
                        <div className="grid grid-cols-3 gap-3 w-full max-w-[180px]">
                            {["XS", "S", "M", "L", "XL", "XXL"].map(size => (
                                <button
                                    key={size}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        addToCart(size);
                                    }}
                                    className="bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 hover:border-white py-3 rounded-lg text-[10px] font-black transition-all duration-300"
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSizes(false); }}
                            className="text-white/40 hover:text-white mt-8 text-[8px] font-black uppercase tracking-widest transition-colors"
                        >
                            ✕ Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* INFO - INSTITUTIONAL DATA */}
            <div className="p-5 flex flex-col flex-1 gap-6">
                <div className="space-y-3">
                    <Link href={`/product/${product.id}`} onClick={handleProductClick} className="block group/title">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 line-clamp-1 group-hover/title:text-black transition-colors">
                            {product.category || "Archive Fleet"}
                        </h3>
                        <p className="text-sm font-black italic tracking-tighter text-black mt-1 line-clamp-1">
                            {product.title}
                        </p>
                    </Link>

                    <div className="flex items-baseline justify-between pt-2 border-t border-gray-50">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-gray-300 uppercase tracking-[0.4em]">Asset Valuation</span>
                            <span className="text-lg font-black italic tracking-tighter text-primary">₹{product.price?.toLocaleString()}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-[7px] font-black text-gray-300 uppercase tracking-[0.4em]">Grade</span>
                            <span className="text-[9px] font-black text-black">A++ Tier</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-gray-50/50 rounded-xl border border-gray-100 mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px]">🔥</span>
                        <div className="flex-1 space-y-1">
                           <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
                              <span>Viral Heat</span>
                              <span>{Math.min(100, Math.floor((product.views || 0) / 5))}%</span>
                           </div>
                           <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (product.views || 0) / 5)}%` }} />
                           </div>
                        </div>
                    </div>
                    <div className="h-3 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-green-600">Authenticated</span>
                    </div>
                </div>

                <div className="mt-auto space-y-3">
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowSizes(true)
                        }}
                        className="w-full bg-black text-white text-[9px] font-black uppercase tracking-[0.3em] py-4 rounded-xl hover:bg-primary hover:text-black transition-all duration-700 shadow-xl relative group/btn overflow-hidden"
                    >
                        <span className="relative z-10 group-hover/btn:tracking-[0.5em] transition-all duration-700">Initialize Drop</span>
                        <div className="absolute inset-x-0 bottom-0 h-0 bg-white opacity-10 group-hover/btn:h-full transition-all duration-700" />
                    </button>
                    <div className="flex items-center justify-center gap-2 opacity-30">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-[6px] font-black uppercase tracking-[0.5em]">Logistics Confirmed</span>
                        <div className="h-px flex-1 bg-gray-200" />
                    </div>
                </div>
            </div>
        </div>
    )
}
