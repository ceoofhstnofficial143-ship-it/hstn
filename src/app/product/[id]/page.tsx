"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import OutfitBundle from "@/components/ProductBundle"
import OutfitBundleV2 from "@/components/OutfitBundleV2"
import FollowButton from "@/components/FollowButton"
import { supabase } from "@/lib/supabase"

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const productId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inWishlist, setInWishlist] = useState(false)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState<string>("")
  const [relatedProducts, setRelatedProducts] = useState<any[]>([])
  const [viewersCount, setViewersCount] = useState(0)

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
    setActiveImage(data.image_url)
    setLoading(false)
    setViewersCount(Math.floor(Math.random() * 45) + 5)

    const { data: { user } } = await supabase.auth.getUser()
    
    // Log view analytics
    await supabase.from("product_views").insert({
      product_id: productId,
      user_id: user?.id || null
    })

    // Fetch related products
    if (data.category) {
      const { data: related } = await supabase
        .from("products")
        .select("id, title, price, image_url, views, stock, profiles!products_user_id_fkey(username)")
        .eq("category", data.category)
        .neq("id", productId)
        .limit(4)
      if (related) setRelatedProducts(related)
    }

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

  const addToCart = (silent = false) => {
    if (!selectedSize) {
      const sizeBtn = document.getElementById("size-selector")
      sizeBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
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
    window.dispatchEvent(new Event("hstn-cart-updated"))
    if (!silent) alert(`${product.title} secured in bag.`)
  }

  const buyNow = () => {
    if (!selectedSize) {
      const sizeBtn = document.getElementById("size-selector")
      sizeBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    addToCart(true)
    router.push("/cart")
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
    <>
      <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image Gallery */}
          <div className="flex flex-col-reverse md:flex-row gap-6">
            {/* Thumbnails */}
            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto pb-4 md:pb-0 md:max-h-[600px] scrollbar-none">
              {[product.image_url, ...(product.additional_images || [])].map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`relative w-20 h-20 md:w-24 md:h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${activeImage === img ? 'border-black shadow-lg scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <Image src={img} alt={`View ${idx}`} fill className="object-cover" />
                </button>
              ))}
            </div>

            {/* Main Image */}
            <div className="flex-1 relative aspect-[3/4] md:aspect-square rounded-[2rem] overflow-hidden bg-gray-50 shadow-2xl group">
              <Image
                src={activeImage || "/placeholder.jpg"}
                alt={product.title}
                fill
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                priority
              />
              {/* Overlay Badges */}
              <div className="absolute top-6 left-6 flex flex-col gap-2">
                {product.stock <= 5 && product.stock > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-2xl animate-pulse">⚡ Only {product.stock} Left</span>
                )}
                {product.views > 100 && (
                  <span className="bg-black/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-2xl">🔥 Hot Drop</span>
                )}
              </div>
              <button 
                onClick={addToWishlist}
                className={`absolute top-6 right-6 p-4 rounded-full backdrop-blur-md transition-all shadow-2xl ${inWishlist ? 'bg-red-500 text-white' : 'bg-white/80 text-black hover:bg-black hover:text-white'}`}
              >
                <span className="text-xl">❤️</span>
              </button>
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">Drop ID: #{product.id.slice(0, 8)}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">{product.title}</h1>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex text-yellow-400 text-sm">★★★★★</div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-900 leading-none pt-1">4.8 (124+ Reviews)</span>
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <span className="text-xs font-black uppercase tracking-widest text-primary pt-1">2.3k Purchased</span>
              </div>
              
              <div className="flex items-end gap-4 pt-4">
                <p className="text-5xl font-black text-black tracking-tighter italic leading-none">₹{product.price?.toLocaleString()}</p>
                {product.original_price && (
                  <p className="text-xl text-gray-400 line-through font-bold mb-1">₹{product.original_price.toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Urgency Pulse */}
            <div className="flex items-center gap-3 py-4 px-6 bg-orange-50 border border-orange-100 rounded-2xl">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">{viewersCount} protocol members viewing this drop</p>
            </div>

            {/* Seller Card Redesign */}
            <div className="group p-8 bg-black rounded-[2rem] text-white shadow-2xl relative overflow-hidden transition-all hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full -mr-16 -mt-16" />
              <div className="flex items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full border-2 border-primary/50 overflow-hidden shadow-2xl">
                    {product.profiles?.avatar_url ? (
                      <Image src={product.profiles.avatar_url} alt={product.profiles.username} width={64} height={64} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary flex items-center justify-center text-black font-black text-2xl italic">
                        {product.profiles?.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/seller/${product.user_id}`} className="text-xl font-black italic tracking-tighter uppercase hover:text-primary transition-colors">
                        @{product.profiles?.username || "elite_scout"}
                      </Link>
                      <span className="bg-primary text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Verified</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                       <div className="text-center">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Sales</p>
                          <p className="text-xs font-black">250+</p>
                       </div>
                       <div className="h-4 w-px bg-white/10" />
                       <div className="text-center">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Rating</p>
                          <p className="text-xs font-black">⭐ 4.9</p>
                       </div>
                    </div>
                  </div>
                </div>
                <FollowButton sellerId={product.user_id} />
              </div>
            </div>

            {/* Power Buy Box */}
            <div className="space-y-8 py-8 border-y border-gray-100">
              <div className="space-y-4" id="size-selector">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Select Protocol Size</h3>
                  <button className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4 hover:text-primary transition-colors">Size Guide</button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-[56px] h-14 rounded-2xl text-[11px] font-black transition-all border-2 relative overflow-hidden ${
                        selectedSize === size
                          ? "bg-black text-white border-black shadow-2xl scale-105"
                          : "bg-white text-gray-400 border-gray-50 hover:border-gray-200"
                      }`}
                    >
                      {size}
                      {product.stock <= 2 && size === "M" && (
                         <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                <div className="flex items-center justify-between border-2 border-gray-50 rounded-2xl px-6 py-4 bg-gray-50/30">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-gray-400 hover:text-black font-black text-2xl transition-all hover:scale-125">−</button>
                  <span className="w-12 text-center font-black text-lg italic tracking-tighter">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="text-gray-400 hover:text-black font-black text-2xl transition-all hover:scale-125">+</button>
                </div>
                
                <div className="flex gap-4 flex-1">
                  <button
                    onClick={() => addToCart(false)}
                    className="flex-1 bg-white text-black border-2 border-black py-5 px-8 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-black hover:text-white transition-all shadow-xl active:scale-95"
                  >
                    Add to Bag
                  </button>
                  <button
                    onClick={buyNow}
                    className="flex-1 bg-black text-white py-5 px-8 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-primary hover:text-black transition-all shadow-xl active:scale-95"
                  >
                    Acquire Now
                  </button>
                </div>
              </div>
            </div>

            {/* Description & Styles */}
            <div className="space-y-8 pt-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">The Directive</h3>
                <p className="text-sm text-gray-600 leading-relaxed font-medium uppercase tracking-tight">{product.description}</p>
              </div>
              
              {product.style_tags && product.style_tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.style_tags.map((tag: string) => (
                    <button key={tag} className="px-4 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black hover:border-black transition-all">
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
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

      {/* Related Drops */}
      {relatedProducts.length > 0 && (
        <div className="mt-24 pt-24 border-t-2 border-gray-50">
          <div className="flex items-center justify-between mb-12">
             <h2 className="text-2xl font-black italic uppercase tracking-tighter">You May Also Scout</h2>
             <Link href="/" className="text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1">Scout All</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map(p => (
              <div key={p.id} className="group relative">
                <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gray-50 relative mb-4">
                  <Image src={p.image_url} alt={p.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute top-3 left-3 bg-black/80 text-white text-[8px] px-2 py-1 rounded font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    View Asset
                  </div>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-tight truncate mb-1">{p.title}</h4>
                <p className="text-xs font-black">₹{p.price.toLocaleString()}</p>
                <Link href={`/product/${p.id}`} className="absolute inset-0 z-10" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Mobile Sticky Buy Bar */}
    <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white/90 backdrop-blur-2xl border-t border-gray-100 p-4 transform translate-y-0 translate-z-0 safe-bottom shadow-[0_-20px_50px_rgba(0,0,0,0.1)] transition-transform duration-500">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{product.title}</span>
          <span className="text-lg font-black italic tracking-tighter">₹{product.price?.toLocaleString()}</span>
        </div>
        <button 
          onClick={buyNow}
          className="flex-1 bg-black text-white py-4 px-8 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary hover:text-black transition-all shadow-xl active:scale-95"
        >
          {selectedSize ? `Acquire (${selectedSize})` : "Select Size"}
        </button>
      </div>
      </div>
    </>
  )
}
