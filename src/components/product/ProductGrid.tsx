"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import ProductCard from "./ProductCard"

interface Product {
  id: string
  title: string
  price: number
  discount_price?: number
  image_url: string
  stock: number
  views_count?: number
  cart_count?: number
}

interface ProductGridProps {
  category?: string
  limit?: number
  showFilters?: boolean
}

export default function ProductGrid({ category, limit, showFilters = false }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState("newest")

  useEffect(() => {
    fetchProducts()
  }, [category, sortBy])

  const fetchProducts = async () => {
    setLoading(true)

    let query = supabase
      .from("products")
      .select("id, title, price, discount_price, image_url, stock, views_count, cart_count")
      .eq("status", "approved")

    if (category) {
      query = query.eq("category", category)
    }

    // Sorting
    switch (sortBy) {
      case "price-low":
        query = query.order("price", { ascending: true })
        break
      case "price-high":
        query = query.order("price", { ascending: false })
        break
      case "popular":
        query = query.order("views_count", { ascending: false })
        break
      default:
        query = query.order("created_at", { ascending: false })
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (!error && data) {
      setProducts(data)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl animate-pulse">
            <div className="aspect-square bg-gray-200" />
            <div className="p-2.5 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No products found</p>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      {showFilters && (
        <div className="flex items-center justify-between px-3 mb-4">
          <span className="text-sm text-gray-500">{products.length} products</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
