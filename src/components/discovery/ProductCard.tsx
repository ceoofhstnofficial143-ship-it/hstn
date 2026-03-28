"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"

interface ProductCardProps {
  product: {
    id: string
    title: string
    price: number
    discount_price?: number
    image_url: string
    video_url?: string
    stock: number
    rating?: number
    views_count?: number
    cart_count?: number
  }
  isActive: boolean
  onDoubleTap: () => void
  showHeart: boolean
}

export default function ProductCard({ product, isActive, onDoubleTap, showHeart }: ProductCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lastTap, setLastTap] = useState(0)
  const [mediaError, setMediaError] = useState(false)

  useEffect(() => {
    if (videoRef.current && product.video_url) {
      if (isActive) {
        videoRef.current.play().catch(() => {})
      } else {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
    }
  }, [isActive, product.video_url])

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap < 300) {
      onDoubleTap()
    }
    setLastTap(now)
  }

  const displayPrice = product.discount_price || product.price
  const hasDiscount = product.discount_price && product.discount_price < product.price

  return (
    <div 
      className="relative w-full h-screen bg-black flex items-center justify-center"
      onClick={handleTap}
    >
      {/* Media */}
      {product.video_url && !mediaError ? (
        <video
          ref={videoRef}
          src={product.video_url}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          loop
          onError={() => setMediaError(true)}
        />
      ) : (
        <Image
          src={product.image_url || "/placeholder.jpg"}
          alt={product.title}
          fill
          className="object-cover"
          priority={isActive}
          onError={() => setMediaError(true)}
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Double-tap Heart Animation */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-ping">❤️</div>
        </div>
      )}

      {/* Product Info - Bottom Left */}
      <div className="absolute bottom-20 left-4 right-20 z-10">
        <h2 className="text-white text-xl font-black line-clamp-2 mb-2">
          {product.title}
        </h2>
        
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-2xl font-black">₹{displayPrice}</span>
          {hasDiscount && (
            <span className="text-gray-400 text-sm line-through">₹{product.price}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
          {product.stock > 0 && product.stock <= 5 && (
            <span className="bg-red-500/80 px-2 py-1 rounded-full">
              🔥 Only {product.stock} left
            </span>
          )}
          {product.rating && (
            <span>⭐ {product.rating.toFixed(1)}</span>
          )}
          {product.views_count && (
            <span>👀 {product.views_count} viewing</span>
          )}
        </div>
      </div>
    </div>
  )
}
