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
  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)
  const isFetchingRef = useRef(false)

  const BATCH_SIZE = 5

  const fetchProducts = useCallback(async (page: number, append = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price, discount_price, image_url, video_url, stock, rating, views_count, cart_count")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

      if (error) {
        console.error("Error fetching products:", error)
      } else {
        if (!data || data.length < BATCH_SIZE) {
          hasMoreRef.current = false
        }

        if (append) {
          setProducts(prev => [...prev, ...(data || [])])
        } else {
          setProducts(data || [])
        }
      }
    } catch (err) {
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchProducts(0)
  }, [fetchProducts])

  // Handle scroll for active index and infinite loading
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const scrollTop = container.scrollTop
    const viewportHeight = container.clientHeight
    const newIndex = Math.round(scrollTop / viewportHeight)
    
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex)
    }

    // Load more when nearing bottom
    const scrollHeight = container.scrollHeight
    const scrollBottom = scrollTop + viewportHeight
    
    if (scrollBottom >= scrollHeight - viewportHeight * 2 && hasMoreRef.current && !loadingMore) {
      pageRef.current += 1
      fetchProducts(pageRef.current, true)
    }
  }, [activeIndex, loadingMore, fetchProducts])

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
    setTimeout(() => setShowHeart(false), 600)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <p className="text-lg">No products found</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory bg-black"
      style={{
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}
    >
      {products.map((product, index) => (
        <div
          key={product.id}
          data-index={index}
          className="w-full h-screen snap-start snap-always relative flex-shrink-0"
          style={{ scrollSnapAlign: 'start' }}
        >
          <ProductCard
            product={product}
            isActive={index === activeIndex}
            onDoubleTap={() => handleDoubleTap(product.id)}
            showHeart={showHeart && index === activeIndex}
            isLiked={likedProducts.has(product.id)}
          />
          <ActionBar
            productId={product.id}
            title={product.title}
            isLiked={likedProducts.has(product.id)}
            onLike={() => handleDoubleTap(product.id)}
          />
        </div>
      ))}

      {/* Loading More Spinner */}
      {loadingMore && (
        <div className="w-full h-screen flex items-center justify-center bg-black snap-start">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
