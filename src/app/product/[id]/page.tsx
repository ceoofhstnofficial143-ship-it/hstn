"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import OutfitBundle from "@/components/ProductBundle"
import OutfitBundleV2 from "@/components/OutfitBundleV2"
import FollowButton from "@/components/FollowButton"
import { supabase } from "@/lib/supabase"

export default function ProductPage() {
  const params = useParams()
  const productId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inWishlist, setInWishlist] = useState(false)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    fetchProduct()
  }, [productId])

  const fetchProduct = async () => {
    console.log("Product ID:", productId)
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        profiles!products_user_id_fkey(username, avatar_url)
      `)
      .eq("id", productId)
      .single()

    if (error || !data) {
      console.error("Product fetch failed:", error)
      setProduct(null)
      setLoading(false)
      return
    }

    setProduct(data)
    setLoading(false)

    const { data: { user } } = await supabase.auth.getUser()
    
    // Log view analytics
    await supabase.from("product_views").insert({
      product_id: productId,
      user_id: user?.id || null
    })

    // Update view count in products table
    await supabase
      .from("products")
      .update({ views: (data.views || 0) + 1 })
      .eq("id", productId)
  }

  const addToWishlist = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert("Please sign in to save to wishlist")
        return
      }

      if (inWishlist) {
        await supabase
          .from("wishlist")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId)
        setInWishlist(false)
      } else {
        await supabase
          .from("wishlist")
          .insert({ user_id: user.id, product_id: productId })
        setInWishlist(true)
      }
    } catch (error) {
      console.error("Wishlist error:", error)
    }
  }

  const addToCart = () => {
    const cart = JSON.parse(localStorage.getItem("hstn_cart") || "[]")
    const existingIndex = cart.findIndex((item: any) => item.productId === productId && item.size === selectedSize)

    if (existingIndex > -1) {
      cart[existingIndex].qty += quantity
    } else {
      cart.push({
        productId,
        title: product.title,
        price: product.price,
        image: product.image_url,
        size: selectedSize,
        qty: quantity
      })
    }

    localStorage.setItem("hstn_cart", JSON.stringify(cart))
    alert("Added to cart!")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="aspect-square bg-gray-200 rounded-xl"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <p className="text-gray-600 mb-8">The product you're looking for doesn't exist or has been removed.</p>
          <Link href="/" className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-[3/4] md:aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
              <Image
                src={product.image_url || "/placeholder.jpg"}
                alt={product.title}
                width={800}
                height={1000}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                priority
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
              <p className="text-2xl font-bold text-black">₹{product.price?.toLocaleString()}</p>
            </div>

            {/* Seller Info */}
            <div className="flex flex-col gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border border-white shadow-sm">
                    {product.profiles?.avatar_url ? (
                      <Image
                        src={product.profiles.avatar_url}
                        alt={product.profiles.username}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 font-bold text-lg">
                        {product.profiles?.username?.charAt(0).toUpperCase() || "S"}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 flex items-center gap-1">
                      <Link href={`/seller/${product.user_id}`} className="hover:underline">
                        @{product.profiles?.username || "seller"}
                      </Link>
                      <span className="text-blue-500 text-[10px]">✔</span>
                    </p>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Verified Creator</p>
                  </div>
                </div>
                <FollowButton sellerId={product.user_id} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest">Select Size</h3>
              <div className="flex flex-wrap gap-2">
                {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 rounded-xl text-xs font-black transition-all border ${
                      selectedSize === size
                        ? "bg-black text-white border-black shadow-lg"
                        : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-2 bg-gray-50/50">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-gray-400 hover:text-black font-bold p-2 text-xl"
                >
                  -
                </button>
                <span className="w-12 text-center font-black text-sm">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="text-gray-400 hover:text-black font-bold p-2 text-xl"
                >
                  +
                </button>
              </div>
              
              <div className="flex gap-4 flex-1">
                <button
                  onClick={addToCart}
                  disabled={!selectedSize}
                  className="flex-1 bg-black text-white py-4 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-800 transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed shadow-xl"
                >
                  {selectedSize ? "Add to Cart" : "Select Size"}
                </button>
                <button
                  onClick={addToWishlist}
                  className={`p-4 rounded-xl transition-all border shadow-lg flex items-center justify-center shrink-0 ${
                    inWishlist
                      ? "bg-red-50 border-red-100 text-red-500"
                      : "bg-white border-gray-100 text-gray-400 hover:text-black"
                  }`}
                >
                  <span className="text-xl">❤️</span>
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            </div>

            {/* Complete the Look (AI-Driven) */}
            <div className="mb-12">
              <OutfitBundle currentProduct={product} />
            </div>

            {/* Curated Outfit Bundles (V2) */}
            <div className="mt-16 pt-16 border-t border-gray-100">
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] italic text-purple-600">Curated Ensembles</h2>
                <div className="h-px flex-1 bg-purple-50" />
              </div>
              <OutfitBundleV2 limit={1} />
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Category:</span>
                  <span className="ml-2 text-gray-900">{product.category}</span>
                </div>
                <div>
                  <span className="text-gray-500">Stock:</span>
                  <span className="ml-2 text-gray-900">{product.stock} available</span>
                </div>
                {product.measurements && (
                  <>
                    <div>
                      <span className="text-gray-500">Size:</span>
                      <span className="ml-2 text-gray-900">{product.measurements.size || "See measurements"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fit:</span>
                      <span className="ml-2 text-gray-900">{product.fit_type || "Standard"}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Reviews Section - Placeholder */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Reviews</h3>
              <div className="text-center py-8 text-gray-500">
                <p>Reviews system coming soon!</p>
                <p className="text-sm mt-1">Be the first to review this product.</p>
              </div>
            </div>

            {/* V2: Product Bundle */}
            <div className="mt-12">
              <OutfitBundleV2 limit={1} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
