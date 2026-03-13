"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { rankProducts } from "@/lib/feedRanker"
import ProductCard from "@/components/ProductCard"
import { useRouter } from "next/navigation"

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  const categories = [
    { name: "All", slug: "all", icon: "🔥" },
    { name: "CO-ORD SETS", slug: "coord_sets", icon: "👗" },
    { name: "TRENDY TOPS", slug: "trendy_tops", icon: "👚" },
    { name: "CASUAL DRESSES", slug: "casual_dresses", icon: "👗" },
    { name: "KOREAN-STYLE FASHION", slug: "korean_style", icon: "🇰🇷" }
  ]

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        profiles!products_user_id_fkey(username)
      `)
      .eq("admin_status", "approved")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Product fetch error:", error)
      setLoading(false)
      return
    }

    // Optimize trust score fetching - fetch all at once instead of per product
    const userIds = [...new Set(data.map(p => p.user_id))]
    const { data: trustData } = await supabase
      .from("trust_scores")
      .select("*")
      .in("user_id", userIds)

    const productsWithTrust = data.map(product => {
      const trust = trustData?.find(t => t.user_id === product.user_id)
      return { ...product, trust }
    })

    const ranked = rankProducts(productsWithTrust)

    setProducts(ranked ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // Filter products when category changes
  useEffect(() => {
    if (selectedCategory === "All") {
      setFilteredProducts(products)
    } else {
      setFilteredProducts(products.filter(p => p.category === selectedCategory))
    }
  }, [selectedCategory, products])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header Skeleton */}
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="h-8 w-24 bg-gray-200 rounded"></div>
            <div className="flex gap-4">
              <div className="h-10 w-20 bg-gray-200 rounded"></div>
              <div className="h-10 w-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">HSTN</h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search fashion..."
                  className="w-64 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
              <Link href="/upload" className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
                Sell
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filters */}
        <div className="mb-8">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  selectedCategory === cat.name
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Count */}
        <div className="mb-6">
          <p className="text-gray-600 text-sm">
            {filteredProducts.length} pieces live on HSTN
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👗</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">Be the first to list in this category!</p>
            <Link href="/upload" className="bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
              Start Selling
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
