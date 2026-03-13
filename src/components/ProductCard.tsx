"use client"

import React from "react"
import Link from "next/link"

interface ProductCardProps {
    product: any
    fullScreen?: boolean
}

export default function ProductCard({ product, fullScreen = false }: ProductCardProps) {
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
                    <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                    />
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
                <Link href={`/products/${product.id}`} className="absolute inset-0" />
            </div>
        )
    }

    return (
        <div className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 relative">
            <Link href={`/products/${product.id}`}>
                <img
                    src={product.image_url}
                    alt={product.title}
                    loading="lazy"
                    className="
                        aspect-square
                        object-cover
                        w-full
                        group-hover:scale-105
                        transition-transform
                        duration-300
                    "
                />
            </Link>

            {/* Hover Actions - Desktop Only */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden md:flex flex-col gap-2">
                <button className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition-colors">
                    <span className="text-sm">👁️</span>
                </button>
                <button className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition-colors">
                    <span className="text-sm">❤️</span>
                </button>
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                    {product.title}
                </h3>
                <p className="text-lg font-bold text-gray-900 mb-2">
                    ₹{product.price?.toLocaleString()}
                </p>
                {product.trust && (
                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <span>⭐</span>
                        <span>Trust Score {product.trust.score}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
