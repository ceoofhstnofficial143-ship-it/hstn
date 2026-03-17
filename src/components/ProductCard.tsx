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

    const [showSizes, setShowSizes] = React.useState(false);

    const addToCart = (size: string) => {
        const cart = JSON.parse(localStorage.getItem("hstn_cart") || "[]")
        const newItem = {
            productId: product.id,
            title: product.title,
            price: product.price,
            image: product.image_url,
            size: size,
            qty: 1
        }
        
        // Check if existing
        const existingIdx = cart.findIndex((i: any) => i.productId === product.id && i.size === size)
        if (existingIdx > -1) {
            cart[existingIdx].qty += 1
        } else {
            cart.push(newItem)
        }
        
        localStorage.setItem("hstn_cart", JSON.stringify(cart))
        window.dispatchEvent(new Event("hstn-cart-updated"))
        setShowSizes(false)
        alert(`Success: ${product.title} (Size ${size}) added to your vault.`)
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
                        {(product.views > 50 || product.stock <= 5) && (
                            <span className="bg-black text-white px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest shadow-2xl">
                                {product.stock <= 5 && product.stock > 0 ? '⚡ Limited' : '🔥 Trending'}
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
                        className="bg-white/95 backdrop-blur-md p-2.5 rounded-full shadow-2xl hover:bg-black hover:text-white transition-all duration-300 transform hover:scale-110"
                    >
                        <span className="text-sm">❤️</span>
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

            {/* INFO */}
            <div className="p-4 flex flex-col flex-1 space-y-2">
                <div className="flex justify-between items-start gap-2">
                    <Link href={`/product/${product.id}`} onClick={handleProductClick} className="flex-1">
                        <h3 className="font-bold text-xs uppercase tracking-tight text-gray-900 line-clamp-2 leading-relaxed group-hover:text-primary transition-colors">
                            {product.title}
                        </h3>
                    </Link>
                    <div className="text-right">
                        <span className="text-gray-400 text-[8px] uppercase font-black block tracking-widest mb-0.5">Price</span>
                        <div className="font-black text-sm text-black tabular-nums">
                            ₹{product.price?.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between py-2 border-y border-gray-50">
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100/50">
                            <span className="text-[9px]">⭐</span>
                            <span className="text-[10px] font-black text-yellow-700 ml-1">{mockRating}</span>
                        </div>
                        <span className="text-gray-300 text-[8px]">|</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{mockSold}+ Sold</span>
                    </div>
                    <div className="text-[10px] font-black text-green-600 italic tracking-tighter">
                        ✓ Authenticated
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                           <span className="text-[8px] font-bold text-gray-400">?</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                            {product.profiles?.username || product.seller_username || 'Elite Seller'}
                        </div>
                    </div>
                    {product.style_tags && product.style_tags.length > 0 && (
                        <div className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                            #{product.style_tags[0]}
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-auto">
                    <button 
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowSizes(true)
                        }}
                        className="w-full bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] py-4 rounded-xl hover:bg-primary hover:text-black transition-all duration-500 flex items-center justify-center gap-3 shadow-xl transform active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Initialize Drop
                    </button>
                    <p className="text-[8px] text-center text-gray-400 uppercase tracking-widest mt-2 font-bold">
                        ⚡ Ships in 24h • Free Returns
                    </p>
                </div>
            </div>
        </div>
    )
}
