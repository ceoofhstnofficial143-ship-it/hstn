"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import OutfitBundleV2 from "@/components/OutfitBundleV2"
import FollowButton from "@/components/FollowButton"
import ProductCard from "@/components/ProductCard"
import { supabase } from "@/lib/supabase"

// --- Sub-components (Copied from original page) ---

const Breadcrumbs = ({ category, title }: { category: string; title: string }) => {
  const router = useRouter()
  return (
    <nav className="flex items-center gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
      <button
        onClick={() => router.back()}
        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-black transition-colors"
      >
        <span className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center group-hover:border-black transition-colors">←</span>
        Back
      </button>
      <div className="h-4 w-px bg-gray-100" />
      <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.4em] text-gray-300">
        <Link href="/" className="hover:text-black transition-colors">Archive</Link>
        <span>/</span>
        <Link href={`/?category=${category?.toLowerCase()}`} className="text-gray-400 hover:text-black transition-colors">{category || "Fleet"}</Link>
        <span>/</span>
        <span className="text-black italic">{title}</span>
      </div>
    </nav>
  )
}

interface MediaItem {
  url: string
  type: 'image' | 'video'
  label?: string // hero, front, back, fabric, model, lifestyle, video
}

const ImageGallery = ({ media, activeMedia, setActiveMedia, title, stock }: { media: MediaItem[]; activeMedia: MediaItem; setActiveMedia: (m: MediaItem) => void; title: string; stock: number }) => {
  const [zoomStyle, setZoomStyle] = useState({ display: 'none', backgroundPosition: '0% 0%', backgroundImage: '' })
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMedia.type === 'video') return
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const x = ((e.pageX - left - window.scrollX) / width) * 100
    const y = ((e.pageY - top - window.scrollY) / height) * 100
    setZoomStyle({
      display: 'block',
      backgroundPosition: `${x}% ${y}%`,
      backgroundImage: `url(${activeMedia.url})`
    })
  }

  const handleMouseLeave = () => {
    setZoomStyle({ ...zoomStyle, display: 'none' })
  }

  // 🔄 Sync mobile scroll when activeMedia changes (e.g., thumbnail clicked)
  useEffect(() => {
    if (window.innerWidth < 1024 && scrollRef.current) {
        const index = media.findIndex(m => m.url === activeMedia.url);
        if (index !== -1) {
            const currentScrollIndex = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
            if (index !== currentScrollIndex) {
                scrollRef.current.scrollTo({
                    left: index * scrollRef.current.offsetWidth,
                    behavior: 'smooth'
                });
            }
        }
    }
  }, [activeMedia]);

  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 1024) return
    const scrollLeft = e.currentTarget.scrollLeft
    const width = e.currentTarget.offsetWidth
    const index = Math.round(scrollLeft / width)
    
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    
    scrollTimeout.current = setTimeout(() => {
        if (media[index] && media[index].url !== activeMedia.url) {
            setActiveMedia(media[index])
            if (media[index].type === 'video') setIsVideoPlaying(true)
        }
    }, 50)
  }

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause()
        setIsVideoPlaying(false)
      } else {
        videoRef.current.play()
        setIsVideoPlaying(true)
      }
    }
  }

  const getMediaIcon = (type: 'image' | 'video') => {
    if (type === 'video') {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )
    }
    return (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-6 animate-in fade-in slide-in-from-left-8 duration-1000">
      <div className="hidden lg:flex lg:flex-col gap-3 overflow-y-auto lg:max-h-[700px] scrollbar-none px-1">
        {media.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveMedia(item)
              if (item.type === 'video') {
                setIsVideoPlaying(true)
                setTimeout(() => videoRef.current?.play(), 100)
              } else {
                setIsVideoPlaying(false)
                videoRef.current?.pause()
              }
            }}
            className={`relative w-24 h-32 flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all duration-500 group ${activeMedia.url === item.url ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            {item.type === 'video' ? (
              <div className="relative w-full h-full bg-gray-900">
                <video src={item.url} className="object-cover w-full h-full" muted playsInline />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                    <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
            ) : (
              <Image src={item.url} alt={`${title} ${item.label || idx}`} fill className="object-cover" />
            )}
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white p-1 rounded-md">
              {getMediaIcon(item.type)}
            </div>
            {item.label && (
              <div className="absolute top-2 left-2 bg-primary text-black text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 relative">
        <div ref={scrollRef} onScroll={handleScroll} className="lg:hidden flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none aspect-[3/4] rounded-[2rem] shadow-xl">
          {media.map((item, idx) => (
            <div key={idx} className="flex-shrink-0 w-full h-full snap-start snap-always relative">
              {item.type === 'video' ? (
                <video
                  ref={idx === media.findIndex(m => m.url === activeMedia.url) ? videoRef : undefined}
                  src={item.url}
                  className="object-cover w-full h-full"
                  autoPlay
                  muted
                  playsInline
                  loop
                />
              ) : (
                <Image src={item.url} alt={title} fill className="object-cover" priority={idx === 0} />
              )}
            </div>
          ))}
        </div>

        <div className="hidden lg:block relative aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-gray-50 border border-gray-100 group cursor-crosshair shadow-2xl transition-all duration-700"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}>
          {activeMedia.type === 'video' ? (
            <div className="relative w-full h-full" onClick={handleVideoClick}>
              <video ref={videoRef} src={activeMedia.url} className="object-cover w-full h-full" autoPlay={isVideoPlaying} muted playsInline loop />
              <div className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 ${isVideoPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                  {isVideoPlaying ? (
                    <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                  ) : (
                    <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <Image src={activeMedia.url || "/placeholder.jpg"} alt={title} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" priority />
              <div
                className="absolute inset-0 pointer-events-none bg-no-repeat transition-opacity duration-300 z-10"
                style={{ ...zoomStyle, backgroundSize: '250%', opacity: zoomStyle.display === 'block' ? 1 : 0 }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PhotoReviews = ({ productId }: { productId: string }) => {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', photo_url: '' })

  useEffect(() => {
    fetchReviews()
  }, [productId])

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select(`*, profiles!reviews_user_id_fkey(username, avatar_url)`)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(8)

    if (!error && data) setReviews(data)
    setLoading(false)
  }

  const submitReview = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return alert("Sign in to submit your fit.")

    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: user.id,
      rating: newReview.rating,
      comment: newReview.comment,
      photo_url: newReview.photo_url || null,
      user_name: user.email?.split('@')[0] || 'Anonymous'
    })

    if (error) {
      alert(error.message.includes('delivered') ? "Only buyers with delivered orders can review." : error.message)
      return
    }

    setNewReview({ rating: 5, comment: '', photo_url: '' })
    setShowReviewForm(false)
    fetchReviews()
    alert("Review submitted successfully!")
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0'

  const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

  if (loading) return null

  return (
    <div className="mt-32 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-12">
        <div className="w-full md:w-1/3 text-center md:text-left">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-6">Community Feedback</h2>
          <div className="flex flex-col items-center md:items-start">
            <div className="text-7xl font-black italic tracking-tighter text-black mb-2">{averageRating}</div>
            <div className="flex text-primary text-2xl mb-4">{renderStars(Math.round(Number(averageRating)))}</div>
            <button onClick={() => setShowReviewForm(!showReviewForm)} className="mt-8 h-14 w-full md:w-auto px-8 bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-all">Submit Your Fit</button>
          </div>
        </div>
      </div>

      {showReviewForm && (
        <div className="mb-12 p-8 bg-gray-50 rounded-[2rem] border border-gray-100">
          <h3 className="text-lg font-black uppercase tracking-wider mb-6">Write Your Review</h3>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setNewReview({ ...newReview, rating: star })} className={`text-2xl transition-all ${newReview.rating >= star ? 'text-primary' : 'text-gray-300 hover:text-primary'}`}>★</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Your Experience</label>
              <textarea value={newReview.comment} onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} placeholder="Share your thoughts on this drop..." className="w-full h-32 p-4 border-2 border-gray-200 rounded-2xl text-sm focus:border-black focus:outline-none resize-none" />
            </div>
            <div className="flex gap-4">
              <button onClick={submitReview} className="flex-1 h-14 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-primary hover:text-black transition-all">Submit Review</button>
              <button onClick={() => setShowReviewForm(false)} className="h-14 px-8 border-2 border-gray-200 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:border-black transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {reviews.map((review) => (
            <div key={review.id} className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-gray-100 shadow-xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-2">
              {review.photo_url ? (
                <Image src={review.photo_url} alt="Review" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"><div className="text-6xl font-black text-gray-300 italic">"</div></div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                <div className="flex text-primary text-xs mb-2">{renderStars(review.rating)}</div>
                <p className="text-white text-sm font-bold italic line-clamp-3">"{review.comment}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SizeGuide = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-[2rem] p-12 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8">Size Protocol</h2>
        <p className="text-sm text-gray-600 mb-8">Our institutional cut is true-to-size. For an oversized drop, we recommend deploying one size above your standard metric.</p>
        <button onClick={onClose} className="w-full h-14 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-primary">Return to Terminal</button>
      </div>
    </div>
  )
}

const SellerCard = ({ profile, userId }: { profile: any; userId: string }) => (
  <div className="p-8 bg-black rounded-[2.5rem] text-white flex items-center justify-between group overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.02]">
    <div className="flex items-center gap-6 relative z-10">
      <div className="w-16 h-16 rounded-full border-2 border-primary/50 overflow-hidden bg-gray-800 relative">
        {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Seller" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xl text-primary italic bg-primary/10 uppercase">{profile?.username?.charAt(0) || "P"}</div>}
      </div>
      <div>
        <div className="flex items-center gap-3">
          <Link href={`/seller/${userId}`} className="text-xl font-black italic tracking-tighter hover:text-primary transition-colors uppercase">@{profile?.username || "elite_scout"}</Link>
          <span className="bg-primary text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase animate-pulse">Verified</span>
        </div>
      </div>
    </div>
    <div className="relative z-10"><FollowButton sellerId={userId} /></div>
  </div>
)

export default function ProductClient() {
  const params = useParams()
  const router = useRouter()
  const productId = (Array.isArray(params?.id) ? params.id[0] : params?.id) || ""

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inWishlist, setInWishlist] = useState(false)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<any[]>([])
  const [viewersCount, setViewersCount] = useState(0)
  const [variants, setVariants] = useState<any[]>([])
  const [showSizeGuide, setShowSizeGuide] = useState(false)
  const [activeTab, setActiveTab] = useState('description')

  useEffect(() => {
    fetchProduct()
  }, [productId])

  const fetchProduct = async () => {
    const { data, error } = await supabase.from("products").select(`*, profiles!products_user_id_fkey(username, avatar_url)`).eq("id", productId).single()
    if (error || !data) { setProduct(null); setLoading(false); return; }
    setProduct(data)
    setLoading(false)
    const initialMedia: MediaItem[] = [
      { url: data.image_url, type: 'image', label: 'hero' },
      ...(data.additional_images || []).map((url: string) => ({ url, type: 'image' as const })),
      ...(data.video_url ? [{ url: data.video_url, type: 'video' as const, label: 'video' }] : [])
    ]
    if (initialMedia.length > 0) setActiveMedia(initialMedia[0])
    setViewersCount(Math.floor(Math.random() * 45) + 5)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: wish } = await supabase.from("wishlist").select("id").eq("user_id", user.id).eq("product_id", productId).single()
      setInWishlist(!!wish)
    }
    
    if (data.category) {
      const { data: related } = await supabase.from("products").select("id, title, price, image_url, views, stock, profiles!products_user_id_fkey(username)").eq("category", data.category).neq("id", productId).limit(4)
      if (related) setRelatedProducts(related)
    }
    
    const { data: variantData } = await supabase.from("product_variants").select("*").eq("product_id", productId)
    if (variantData && variantData.length > 0) {
      setVariants(variantData)
      if (variantData[0].color) setSelectedColor(variantData[0].color)
    }
  }

  const addToWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return alert("Sign in to save drops.")
    if (inWishlist) {
      await supabase.from("wishlist").delete().eq("user_id", user.id).eq("product_id", productId); setInWishlist(false)
    } else {
      await supabase.from("wishlist").insert({ user_id: user.id, product_id: productId }); setInWishlist(true)
    }
  }

  const getPriceForVariant = (size: string, color?: string) => {
    if (variants.length === 0) return product?.price || 0
    return variants.find(v => v.size === size && (!color || v.color === color))?.price || product?.price || 0
  }

  const addToCart = () => {
    if (!selectedSize) return alert("Select protocol size.")
    const cart = JSON.parse(localStorage.getItem("hstnlx_cart") || "[]")
    const variantPrice = getPriceForVariant(selectedSize, selectedColor || undefined)
    
    // ⚔️ INJECT SELLER_ID (Distributed Transaction Key)
    cart.push({ 
        productId, 
        seller_id: product.user_id, // The vendor's ID
        title: product.title, 
        price: variantPrice, 
        image: product.image_url, 
        size: selectedSize, 
        color: selectedColor, 
        qty: quantity 
    })
    
    localStorage.setItem("hstnlx_cart", JSON.stringify(cart)); 
    window.dispatchEvent(new Event("hstnlx-cart-updated"))
    alert("Asset secured in bag.")
  }

  const buyNow = () => {
    if (!selectedSize) return alert("Select protocol size.")
    addToCart(); router.push("/cart")
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8 animate-pulse">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 aspect-[3/4] bg-gray-50 rounded-[3rem]" />
        <div className="lg:col-span-12 xl:col-span-5 space-y-10 my-auto">
          <div className="h-24 bg-gray-50 rounded-3xl w-full" />
          <div className="h-12 bg-gray-50 rounded-2xl w-1/3" />
          <div className="space-y-4 pt-8 border-t border-gray-100">
            <div className="h-20 bg-gray-50 rounded-3xl" />
            <div className="h-20 bg-gray-900 rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  )

  if (!product) return <div className="min-h-screen flex items-center justify-center font-black italic uppercase text-gray-400">Archive Entry Missing / 404</div>

  const media: MediaItem[] = [
    { url: product.image_url, type: 'image', label: 'hero' },
    ...(product.additional_images || []).map((url: string, idx: number) => ({ 
      url, 
      type: 'image' as const, 
      label: ['front', 'back', 'fabric', 'model', 'lifestyle'][idx % 5] 
    })),
    ...(product.video_url ? [{ url: product.video_url, type: 'video' as const, label: 'motion' }] : [])
  ]

  return (
    <div className="min-h-screen bg-white text-black selection:bg-primary selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-20">
        <div className="flex flex-col lg:flex-row gap-16 xl:gap-24 items-start">
          
          {/* 🖼️ GALLERY PROTOCOL (Left) */}
          <div className="w-full lg:w-[60%] space-y-8">
            <Breadcrumbs category={product.category} title={product.title} />
            <div className="relative group">
              {activeMedia && (
                <ImageGallery 
                  media={media} 
                  activeMedia={activeMedia} 
                  setActiveMedia={setActiveMedia} 
                  title={product.title} 
                  stock={product.stock} 
                />
              )}
              {/* Media Progress Indicator */}
              <div className="pointer-events-none sticky bottom-10 left-0 right-0 z-20 flex justify-center lg:hidden">
                <div className="flex gap-1.5 px-4 py-2 bg-black/80 backdrop-blur-md rounded-full ring-1 ring-white/20">
                  {media.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1 rounded-full transition-all duration-500 ${
                        media.findIndex(m => m.url === activeMedia?.url) === idx 
                          ? 'w-6 bg-primary' 
                          : 'w-1.5 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Extended Visual Narrative (Visible on scroll) */}
            <div className="hidden lg:grid grid-cols-2 gap-8 pt-20">
               {media.slice(1, 3).map((m, i) => (
                 <div key={i} className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden group shadow-lg hover:shadow-2xl transition-all duration-700">
                    <Image src={m.url} fill className="object-cover transition-transform duration-1000 group-hover:scale-110" alt="Detail" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                 </div>
               ))}
            </div>
          </div>

          {/* 💰 ACQUISITION PROTOCOL (Right - Sticky) */}
          <div className="w-full lg:w-[40%] sticky top-32 space-y-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] px-3 py-1 bg-gray-50 text-gray-400 rounded-full border border-gray-100">
                    {product.category || 'Limited Edition'}
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full border border-green-100">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-green-600">Active Viewing</span>
                  </div>
                </div>
                <h1 className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-[0.85] text-balance">
                  {product.title}
                </h1>
                <div className="flex items-baseline gap-4">
                  <span className="text-6xl font-black italic tracking-tighter text-primary">₹{product.price?.toLocaleString()}</span>
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Institutional Grade Assets</span>
                </div>
              </div>

              {/* Viewer Analytics Context */}
              <div className="p-5 bg-black rounded-[2rem] text-white flex items-center justify-between border-2 border-primary/20 shadow-2xl">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-1">Stock Trajectory</p>
                   <p className="text-sm font-bold italic tracking-tight">{product.stock > 10 ? 'Available for Deployment' : 'Critical Shortage Protocol Activel'}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xl font-black italic tracking-tighter">{viewersCount}</p>
                    <p className="text-[7px] font-black uppercase tracking-widest text-primary">Live Locks</p>
                 </div>
              </div>

              {/* Sizing Matrix */}
              <div className="space-y-6 pt-8 border-t border-gray-100">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 flex items-center gap-2">
                    Size Selection <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </h3>
                  <button onClick={() => setShowSizeGuide(true)} className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4 hover:text-primary transition-colors">Dimension Grid</button>
                </div>
                
                {/* Show available sizes from variants or fallback to hardcoded */}
                {variants.length > 0 ? (
                  <div className="grid grid-cols-5 gap-3">
                    {variants.map(v => (
                      <button 
                        key={v.size} 
                        onClick={() => setSelectedSize(v.size)} 
                        className={`group relative h-16 rounded-2xl font-black transition-all duration-500 border-2 ${
                          selectedSize === v.size 
                            ? 'bg-black text-white border-black shadow-[0_20px_40px_rgba(0,0,0,0.15)] scale-105' 
                            : v.stock > 0 
                              ? 'bg-white border-gray-100 hover:border-black text-gray-400 hover:text-black'
                              : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through'
                        }`}
                        disabled={v.stock <= 0}
                      >
                        <span className="relative z-10">{v.size}</span>
                        {selectedSize === v.size && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full ring-4 ring-white" />
                        )}
                        {v.stock > 0 && v.stock <= 3 && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-bold text-orange-500">LOW</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-3">
                    {["XS", "S", "M", "L", "XL"].map(s => (
                      <button 
                        key={s} 
                        onClick={() => setSelectedSize(s)} 
                        className={`group relative h-16 rounded-2xl font-black transition-all duration-500 border-2 ${
                          selectedSize === s 
                            ? 'bg-black text-white border-black shadow-[0_20px_40px_rgba(0,0,0,0.15)] scale-105' 
                            : 'bg-white border-gray-100 hover:border-black text-gray-400 hover:text-black'
                        }`}
                      >
                        <span className="relative z-10">{s}</span>
                        {selectedSize === s && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full ring-4 ring-white" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 text-center italic">
                  {variants.length > 0 ? `${variants.filter(v => v.stock > 0).length} sizes available` : 'Institutional Cut: Standard True Fit'}
                </p>
              </div>

              {/* Execution Actions */}
              <div className="space-y-4">
                <button 
                  onClick={buyNow} 
                  disabled={!selectedSize} 
                  className={`group w-full h-24 rounded-[2rem] font-black uppercase tracking-[0.4em] text-sm transition-all duration-700 relative overflow-hidden flex items-center justify-center ${
                    selectedSize 
                      ? 'bg-black text-white hover:bg-primary hover:text-black shadow-2xl' 
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed grayscale'
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-4 group-hover:scale-110 transition-transform">
                    Initialize Purchase <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  </span>
                  <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={addToCart} 
                    className="h-20 rounded-2xl border-2 border-gray-100 font-black uppercase tracking-widest text-[10px] hover:border-black transition-all group"
                  >
                    Add to Bag
                  </button>
                  <button 
                    onClick={addToWishlist} 
                    className={`h-20 rounded-2xl border-2 transition-all flex items-center justify-center text-xl group ${
                      inWishlist ? 'bg-red-500 border-red-500 text-white' : 'border-gray-100 hover:text-red-500'
                    }`}
                  >
                    {inWishlist ? '❤️' : '♡'}
                  </button>
                </div>
              </div>

              {/* Trust Protocol Badges */}
              <div className="grid grid-cols-3 gap-6 py-10 border-y border-gray-100">
                 {[
                   { label: 'Blockchain ID', icon: '📝' },
                   { label: 'Asset Verified', icon: '💎' },
                   { label: 'Logistics Pro', icon: '📦' }
                 ].map((t, i) => (
                   <div key={i} className="flex flex-col items-center text-center gap-3">
                     <span className="text-xl grayscale group-hover:grayscale-0 transition-smooth opacity-40">{t.icon}</span>
                     <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">{t.label}</span>
                   </div>
                 ))}
              </div>

              <SellerCard profile={product.profiles} userId={product.user_id} />

              <div className="space-y-8">
                <div className="flex gap-10 border-b border-gray-100">
                  {['description', 'specifications', 'shipping'].map(tab => (
                    <button 
                      key={tab} 
                      onClick={() => setActiveTab(tab)} 
                      className={`pb-4 text-[10px] font-black uppercase tracking-[0.3em] relative transition-colors ${
                        activeTab === tab ? 'text-black' : 'text-gray-300 hover:text-black'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black animate-in fade-in slide-in-from-left-2" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="min-h-[150px] animate-in fade-in duration-700">
                  <p className="text-sm font-bold uppercase tracking-tight italic text-gray-700 leading-relaxed text-pretty">
                    {activeTab === 'description' ? product.description : 
                     activeTab === 'specifications' ? "Composition: Institutional-grade materials • Assembly: Premium Craftsmanship • Durability: High-Velocity Ready • Care: Professional Clean Protocol." :
                     "Global Priority Delivery • 24H Despatch Protocol • Secured Transit Insurance Included."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PhotoReviews productId={productId} />
        
        {relatedProducts.length > 0 && (
          <div className="mt-40 pt-40 border-t border-gray-100">
            <div className="flex justify-between items-end mb-16">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Discover More</span>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter mt-4">Linked Archives</h2>
              </div>
              <Link href="/" className="text-xs font-black uppercase tracking-[0.3em] border-b-2 border-black pb-2 hover:text-primary hover:border-primary transition-all">Explore Entire Fleet →</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
              {relatedProducts.map(p => (<ProductCard key={p.id} product={p} />))}
            </div>
          </div>
        )}
      </div>
      <SizeGuide isOpen={showSizeGuide} onClose={() => setShowSizeGuide(false)} />
    </div>
  )
}
