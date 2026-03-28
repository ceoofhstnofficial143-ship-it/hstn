"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import ProductCard from "./ProductCard"
import ActionBar from "./ActionBar"

interface Product {
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

export default function DiscoveryFeed() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set())
  const [showHeart, setShowHeart] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)

  const BATCH_SIZE = 5

  const fetchProducts = useCallback(async (page: number, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, title, price, discount_price, image_url, video_url, stock, rating, views_count, cart_count")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

    if (error) {
      console.error("Error fetching products:", error)
      setLoading(false)
      setLoadingMore(false)
      return
    }

    if (!data || data.length < BATCH_SIZE) {
      hasMoreRef.current = false
    }

    if (append) {
      setProducts(prev => [...prev, ...(data || [])])
    } else {
      setProducts(data || [])
    }

    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    fetchProducts(0)
  }, [fetchProducts])

  // Intersection Observer for active card detection
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-index") || "0")
            setActiveIndex(index)
            
            // Load more when nearing bottom
            if (index >= products.length - 2 && hasMoreRef.current && !loadingMore) {
              pageRef.current += 1
              fetchProducts(pageRef.current, true)
            }
          }
        })
      },
      { threshold: 0.6 }
    )

    return () => {
      observerRef.current?.disconnect()
    }
  }, [products.length, loadingMore, fetchProducts])

  // Observe all cards
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const cards = container.querySelectorAll("[data-product-card]")
    cards.forEach((card) => {
      observerRef.current?.observe(card)
    })

    return () => {
      cards.forEach((card) => {
        observerRef.current?.unobserve(card)
      })
    }
  }, [products])

  const handleDoubleTap = (productId: string) => {
    setLikedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
    setShowHeart(true)
    setTimeout(() => setShowHeart(false), 500)
  }

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white">
        <p className="text-lg">No products found</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {products.map((product, index) => (
        <div
          key={product.id}
          data-index={index}
          data-product-card
          className="h-screen snap-start relative"
        >
          <ProductCard
            product={product}
            isActive={index === activeIndex}
            onDoubleTap={() => handleDoubleTap(product.id)}
            showHeart={showHeart && index === activeIndex}
          />
          <ActionBar
            productId={product.id}
            title={product.title}
            onLike={() => handleDoubleTap(product.id)}
          />
        </div>
      ))}

      {/* Loading More Spinner */}
      {loadingMore && (
        <div className="h-screen flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
