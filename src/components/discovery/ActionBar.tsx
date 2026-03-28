"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface ActionBarProps {
  productId: string
  title: string
  onLike?: () => void
  isLiked?: boolean
}

export default function ActionBar({ productId, title, onLike, isLiked }: ActionBarProps) {
  const [liked, setLiked] = useState(isLiked || false)
  const [inCart, setInCart] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showToast, setShowToast] = useState("")

  useEffect(() => {
    setLiked(isLiked || false)
  }, [isLiked])

  useEffect(() => {
    checkCartStatus()
  }, [productId])

  const checkCartStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .single() as { data: { id: string } | null }

    setInCart(!!data)
  }

  const handleLike = () => {
    setLiked(!liked)
    onLike?.()
  }

  const handleAddToCart = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setShowToast("Please login")
      setTimeout(() => setShowToast(""), 2000)
      setLoading(false)
      return
    }

    if (inCart) {
      // Increase quantity
      const { data: existing } = await supabase
        .from("carts")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .single() as { data: { id: string; quantity: number } | null }

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("carts") as any)
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id)
        setShowToast("Quantity +1")
      }
    } else {
      // Add new
      await supabase
        .from("carts")
        .insert({
          user_id: user.id,
          product_id: productId,
          quantity: 1
        } as any)
      setInCart(true)
      setShowToast("Added to cart")
    }

    setTimeout(() => setShowToast(""), 2000)
    setLoading(false)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/product/${productId}`
    if (navigator.share) {
      await navigator.share({ title, url })
    } else {
      await navigator.clipboard.writeText(url)
      setShowToast("Link copied")
      setTimeout(() => setShowToast(""), 2000)
    }
  }

  return (
    <div className="absolute right-3 bottom-32 z-20 flex flex-col gap-4">
      {/* Like */}
      <button
        onClick={handleLike}
        className="flex flex-col items-center gap-1"
      >
        <div className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center ${liked ? 'text-red-500' : 'text-white'}`}>
          <svg className="w-6 h-6" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <span className="text-white text-[10px] font-bold">{liked ? "Liked" : "Like"}</span>
      </button>

      {/* Cart */}
      <button
        onClick={handleAddToCart}
        disabled={loading}
        className="flex flex-col items-center gap-1"
      >
        <div className={`w-12 h-12 rounded-full ${inCart ? 'bg-primary' : 'bg-black/50'} backdrop-blur-sm flex items-center justify-center text-white`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-10 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <span className="text-white text-[10px] font-bold">{inCart ? "In Cart" : "Add"}</span>
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className="flex flex-col items-center gap-1"
      >
        <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 0a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </div>
        <span className="text-white text-[10px] font-bold">Share</span>
      </button>

      {/* Toast */}
      {showToast && (
        <div className="absolute -left-20 top-0 bg-white text-black px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap animate-pulse">
          {showToast}
        </div>
      )}
    </div>
  )
}
