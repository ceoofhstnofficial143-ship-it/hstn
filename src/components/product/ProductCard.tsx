"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface ProductCardProps {
  product: {
    id: string
    title: string
    price: number
    discount_price?: number
    image_url: string
    stock: number
    views_count?: number
    cart_count?: number
  }
}

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showToast, setShowToast] = useState("")

  // Check initial wishlist state
  useEffect(() => {
    const checkWishlist = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .single()

      setIsWishlisted(!!data)
    }
    checkWishlist()
  }, [product.id])

  const displayPrice = product.discount_price || product.price
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const discountPercent = hasDiscount 
    ? Math.round(((product.price - product.discount_price!) / product.price) * 100) 
    : 0

  // Determine badge
  const getBadge = () => {
    if (product.views_count && product.views_count > 100) return { text: "🔥 Trending", color: "text-orange-500" }
    if (product.stock > 0 && product.stock <= 5) return { text: "⚡ Limited", color: "text-red-500" }
    if (hasDiscount && discountPercent >= 30) return { text: `${discountPercent}% OFF`, color: "text-green-600" }
    return null
  }

  const badge = getBadge()

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setShowToast("Login required")
      setTimeout(() => setShowToast(""), 2000)
      setLoading(false)
      // Redirect to login after short delay
      setTimeout(() => router.push("/login"), 1500)
      return
    }

    if (isWishlisted) {
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", product.id)
      
      if (!error) {
        setIsWishlisted(false)
        setShowToast("Removed")
      }
    } else {
      const { error } = await supabase
        .from("wishlist")
        .insert({ user_id: user.id, product_id: product.id } as any)
      
      if (!error) {
        setIsWishlisted(true)
        setShowToast("Wishlisted ❤️")
      }
    }
    
    setTimeout(() => setShowToast(""), 2000)
    setLoading(false)
  }

  return (
    <Link href={`/product/${product.id}`}>
      <div 
        className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image Container */}
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          <Image
            src={product.image_url || "/placeholder.jpg"}
            alt={product.title}
            fill
            className={`object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />

          {/* Wishlist Button */}
          <button
            onClick={handleWishlist}
            disabled={loading}
            className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform z-10"
          >
            <svg 
              className={`w-4 h-4 ${isWishlisted ? 'text-red-500 fill-current' : 'text-gray-400'}`} 
              fill={isWishlisted ? "currentColor" : "none"} 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Badge */}
          {badge && (
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <span className={`text-[10px] font-bold ${badge.color}`}>{badge.text}</span>
            </div>
          )}

          {/* Toast Notification */}
          {showToast && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-white px-4 py-2 rounded-full text-xs font-bold z-20 animate-pulse">
              {showToast}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-2.5">
          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
            {product.title}
          </h3>

          {/* Price */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-bold text-base text-black">
              ₹{displayPrice.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-gray-400 line-through text-xs">
                ₹{product.price.toLocaleString()}
              </span>
            )}
          </div>

          {/* Stock Warning */}
          {product.stock > 0 && product.stock <= 3 && (
            <p className="text-[10px] text-red-500 mt-1 font-medium">
              Only {product.stock} left
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
