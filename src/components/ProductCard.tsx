"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { Analytics } from "@/lib/analytics"

interface ProductCardProps {
    product: any
    fullScreen?: boolean
}

export default function ProductCard({ product, fullScreen = false }: ProductCardProps) {
    const updateProductViews = async (productId: string) => {
        await supabase
            .from("products")
            .update({ views: (product.views || 0) + 1 })
            .eq("id", productId);
    }

    const handleProductClick = () => {
        updateProductViews(product.id)
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
                <Link href={`/product/${product.id}`} className="absolute inset-0" />
            </div>
        )
    }

    const hasSecondImage = product.additional_images && product.additional_images.length > 0;

    return (
        <div className="group bg-white rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <Link href={`/product/${product.id}`} onClick={handleProductClick} className="block relative aspect-square overflow-hidden bg-gray-50">
                {/* Primary Image */}
                <Image
                    src={product.image_url || 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'}
                    alt={product.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className={`object-cover transition-all duration-500 ${hasSecondImage ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
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
                        className="object-cover absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                )}

                {/* TRENDING BADGE */}
                {(product.views > 50 || product.stock <= 5) && (
                    <span className="absolute top-3 left-3 bg-black text-white px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest z-10 shadow-sm">
                        {product.stock <= 5 && product.stock > 0 ? '🔥 Limited' : '🔥 Trending'}
                    </span>
                )}
                {product.is_bundle && (
                    <span className="absolute top-10 left-3 bg-white text-black px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest z-10 shadow-sm border border-gray-100">
                        Outfit Bundle
                    </span>
                )}
            </Link>

            {/* Quick Actions overlay on Image */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
                <button
                    onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) {
                            alert("Authentication Required: Please sign in to secure assets in your vault.")
                            return
                        }
                        try {
                            const { error } = await supabase
                                .from("wishlist")
                                .insert([{ user_id: user.id, product_id: product.id }])

                            if (error) {
                                if (error.code === '23505') alert("Asset already secured in vault.")
                                else throw error
                            } else {
                                Analytics.logWishlistAdd(user.id, product.id, product.user_id)
                                alert(`Vault Entry: ${product.title} secured ♥`)
                            }
                        } catch (err) {
                            console.error("Wishlist Protocol Error:", err)
                        }
                    }}
                    className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition-colors"
                >
                    <span className="text-sm">❤️</span>
                </button>
            </div>

            {/* INFO */}
            <div className="p-3 space-y-1">
                <Link href={`/product/${product.id}`} onClick={handleProductClick}>
                    <h3 className="font-medium text-sm line-clamp-1 text-gray-900 group-hover:underline">
                        {product.title}
                    </h3>
                </Link>

                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="text-yellow-400">⭐</span> 
                    <span>{product.rating || "4.8"}</span>
                    <span>•</span>
                    <span>{product.views || 0} views</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <span className="font-bold text-black">
                        ₹{product.price?.toLocaleString()}
                    </span>
                    {product.original_price && (
                        <span className="text-xs text-gray-400 line-through">
                            ₹{product.original_price.toLocaleString()}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-gray-500 truncate">
                        @{product.profiles?.username || product.seller_username || 'seller'}
                    </div>
                    {product.style_tags && product.style_tags.length > 0 && (
                        <div className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded hidden sm:block">
                            #{product.style_tags[0]}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
