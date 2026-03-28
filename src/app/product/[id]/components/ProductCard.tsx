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
        await (supabase as any)
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

    return (
        <div className="product-card group bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 relative">
            <Link href={`/product/${product.id}`} onClick={handleProductClick}>
                <div className="aspect-square relative overflow-hidden">
                    <Image
                        src={product.image_url || 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="
                            object-cover
                            group-hover:scale-105
                            transition-transform
                            duration-300
                        "
                        onError={(e: any) => {
                            e.target.src = 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'
                        }}
                    />
                </div>
            </Link>

            {/* Hover Actions - Desktop Only */}
            <div className="actions absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden md:flex flex-col gap-2">
                <button 
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        // Quick view logic here - could open modal
                        alert(`Quick view: ${product.title}`)
                    }}
                    className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition-colors"
                >
                    <span className="text-sm">👁</span>
                </button>
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
                            const { error } = await (supabase as any)
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

            <div className="p-4">
                <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2 min-h-[2.5rem] uppercase tracking-tight">
                    {product.title}
                </h3>
                {product.style_tags && product.style_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 mb-3">
                        {product.style_tags.map((tag: string) => (
                            <span key={tag} className="text-[8px] font-black uppercase tracking-widest bg-gray-50 text-gray-400 px-2 py-0.5 rounded-sm">#{tag}</span>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between mt-auto">
                    <p className="text-sm font-black text-gray-900">
                        ₹{product.price?.toLocaleString()}
                    </p>
                    {product.stock <= 5 && product.stock > 0 && (
                        <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter animate-pulse">🔥 Limited Drop</span>
                    )}
                </div>
                {product.is_bundle && (
                    <div className="absolute top-2 left-2 px-3 py-1 bg-white/90 backdrop-blur-md rounded-lg border border-gray-100 shadow-sm z-20">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">Outfit Bundle</span>
                    </div>
                )}
            </div>
        </div>
    )
}
