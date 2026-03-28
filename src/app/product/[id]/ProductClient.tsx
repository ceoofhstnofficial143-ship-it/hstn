"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import OutfitBundleV2 from "@/components/OutfitBundleV2"
import FollowButton from "@/components/FollowButton"
import ProductCard from "@/components/product/ProductCard"
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
      <div className="h-4 w-px bg-gray-100 hidden sm:block" />
      <div className="hidden sm:flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.4em] text-gray-300">
        <Link href="/" className="hover:text-black transition-colors">Archive</Link>
        <span>/</span>
        <Link href={`/?category=${category?.toLowerCase()}`} className="text-gray-400 hover:text-black transition-colors leading-none">{category || "Fleet"}</Link>
        <span>/</span>
        <span className="text-black italic truncate max-w-[100px] md:max-w-none">{title}</span>
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

  useEffect(() => {
    if (window.innerWidth < 1024 && scrollRef.current) {
      const index = media.findIndex(m => m.url === activeMedia.url);
      if (index !== -1) {
        scrollRef.current.scrollTo({
          left: index * scrollRef.current.offsetWidth,
          behavior: 'smooth'
        });
      }
    }
  }, [activeMedia]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 1024) return
    const scrollLeft = e.currentTarget.scrollLeft
    const width = e.currentTarget.offsetWidth
    const index = Math.round(scrollLeft / width)

    if (media[index] && media[index].url !== activeMedia.url) {
      setActiveMedia(media[index])
    }
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

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-6 animate-in fade-in slide-in-from-left-8 duration-1000">
      {/* 🖼️ Thumbnails Grid (Left Desktop Only) */}
      <div className="hidden lg:flex lg:flex-col gap-3 overflow-y-auto lg:max-h-[700px] scrollbar-none px-1">
        {media.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveMedia(item)
              setIsVideoPlaying(item.type === 'video')
            }}
            className={`relative w-24 h-32 flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all duration-500 group ${activeMedia.url === item.url ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-xl' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            {item.type === 'video' ? (
              <div className="relative w-full h-full bg-black">
                <video src={item.url} className="object-cover w-full h-full opacity-60" muted playsInline />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
            ) : (
              <Image src={item.url} alt={`${title} ${idx}`} fill className="object-cover" />
            )}
            {item.label && (
              <div className="absolute top-2 left-2 bg-primary text-black text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 🎬 Main Viewport */}
      <div className="flex-1 relative group/gallery">
        {/* Mobile Swipe Layer */}
        <div ref={scrollRef} onScroll={handleScroll} className="lg:hidden flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none aspect-[3/4] rounded-[2.5rem] shadow-2xl bg-gray-50">
          {media.map((item, idx) => (
            <div key={idx} className="flex-shrink-0 w-full h-full snap-start snap-always relative">
              {item.type === 'video' ? (
                <div className="relative w-full h-full" onClick={handleVideoClick}>
                  <video
                    ref={activeMedia.url === item.url ? videoRef : undefined}
                    src={item.url}
                    className="object-cover w-full h-full"
                    playsInline
                    loop
                    muted
                  />
                  {!isVideoPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-2xl">
                        <svg className="w-10 h-10 text-white ml-1.5 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Image src={item.url} alt={title} fill className="object-cover" priority={idx === 0} />
              )}
            </div>
          ))}
        </div>

        {/* Desktop View Layer */}
        <div className="hidden lg:block relative aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-gray-100 border border-gray-100 group cursor-crosshair shadow-2xl transition-all duration-700"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}>
          {activeMedia.type === 'video' ? (
            <div className="relative w-full h-full" onClick={handleVideoClick}>
              <video ref={videoRef} src={activeMedia.url} className="object-cover w-full h-full" playsInline loop muted={!isVideoPlaying} />
              <div className={`absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-500 ${isVideoPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-3xl flex items-center justify-center shadow-3xl border border-white/20 hover:scale-110 transition-transform">
                  {isVideoPlaying ? (
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                  ) : (
                    <svg className="w-10 h-10 text-white ml-2 shadow-text" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </div>
              </div>
              <div className="absolute bottom-10 left-10 py-3 px-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Trusted Motion Proof 🎥</p>
              </div>
            </div>
          ) : (
            <>
              <Image src={activeMedia.url || "/placeholder.jpg"} alt={title} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
              <div
                className="absolute inset-0 pointer-events-none bg-no-repeat transition-opacity duration-300 z-10"
                style={{ ...zoomStyle, backgroundSize: '300%', opacity: zoomStyle.display === 'block' ? 1 : 0 }}
              />
            </>
          )}
        </div>

        {/* 🔢 Dynamic Media HUD (Mobile Overlay) */}
        <div className="pointer-events-none sticky bottom-6 left-0 right-0 z-20 flex justify-center lg:hidden">
          <div className="flex gap-2 px-6 py-2.5 bg-black/60 backdrop-blur-2xl rounded-full ring-1 ring-white/10 shadow-2xl">
            {media.map((item, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-700 flex items-center justify-center ${media.findIndex(m => m.url === activeMedia?.url) === idx
                  ? 'w-10 bg-primary'
                  : 'w-2 bg-white/20'
                  }`}
              >
                {item.type === 'video' && (
                  <span className={`text-[6px] transition-opacity duration-500 ${media.findIndex(m => m.url === activeMedia.url) === idx ? 'opacity-100' : 'opacity-0'}`}>🎥</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const PhotoReviews = ({ productId }: { productId: string }) => {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', photo_url: '' })

  useEffect(() => {
    fetchReviews()
  }, [productId])

  const fetchReviews = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select(`*, profiles(username, avatar_url)`) // Simplified hint
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(8)

      if (error) {
        console.error("Fetch Error:", error);
      } else if (data) {
        setReviews(data)
      }
    } catch (e) {
      console.error("Reviews fetch failure:", e);
    }
    setLoading(false)
  }

  const submitReview = async () => {
    if (!newReview.comment.trim()) return alert("Deployment Protocol: Review content required.")

    setSubmittingReview(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSubmittingReview(false)
        return alert("Authentication Required: Sign in to submit your vault fit.")
      }

      const { error } = await (supabase as any).from("reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating: newReview.rating,
        comment: newReview.comment.trim(),
        photo_url: newReview.photo_url || null,
        user_name: user.email?.split('@')[0] || 'Anonymous'
      })

      if (error) {
        console.error("Insert Error:", error)
        alert(error.message.includes('delivered') ? "Archival Warning: Only buyers with confirmed deliveries can review." : `Protocol Failure: ${error.message}`)
        setSubmittingReview(false)
        return
      }

      setNewReview({ rating: 5, comment: '', photo_url: '' })
      setShowReviewForm(false)
      fetchReviews()
      alert("Asset Review Secured: Community feedback synchronized.")
    } catch (err) {
      console.error("Critical Review Failure:", err)
      alert("Institutional Protocol Internal Failure. Check archive logs.")
    } finally {
      setSubmittingReview(false)
    }
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0'

  const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

  if (loading) return null

  return (
    <div className="mt-20 md:mt-32 animate-in fade-in slide-in-from-bottom-8 duration-1000 px-4 md:px-6 lg:px-0 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between mb-10 md:mb-16 gap-8 md:gap-12">
        <div className="w-full md:w-1/3 text-center md:text-left">
          <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none mb-4 md:mb-6">Community Feedback</h2>
          <div className="flex flex-col items-center md:items-start">
            <div className="text-5xl md:text-7xl font-black italic tracking-tighter text-black mb-2">{averageRating}</div>
            <div className="flex text-primary text-xl md:text-2xl mb-4">{renderStars(Math.round(Number(averageRating)))}</div>
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
              <button
                onClick={submitReview}
                disabled={submittingReview}
                className={`flex-1 h-14 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-primary hover:text-black transition-all flex items-center justify-center ${submittingReview ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {submittingReview ? "Archiving..." : "Submit Review"}
              </button>
              <button onClick={() => setShowReviewForm(false)} className="h-14 px-8 border-2 border-gray-200 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:border-black transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
  <div className="p-8 bg-black rounded-[2.5rem] text-white space-y-8 group overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.02] border-b-4 border-primary">
    <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl pointer-events-none group-hover:scale-150 transition-transform duration-1000 uppercase">Archive</div>
    <div className="flex items-center justify-between relative z-10">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-full border-2 border-primary/50 overflow-hidden bg-gray-800 relative">
          {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Seller" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xl text-primary italic bg-primary/10 uppercase">{profile?.username?.charAt(0) || "P"}</div>}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/seller/${userId}`} className="text-xl font-black italic tracking-tighter hover:text-primary transition-colors uppercase">@{profile?.username || "elite_scout"}</Link>
            <span className="bg-primary text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase animate-pulse">Official Scout</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Scout Grade:</span>
            <span className="text-[10px] text-primary font-black uppercase tracking-widest">S-Tier (Legit)</span>
          </div>
        </div>
      </div>
      <FollowButton sellerId={userId} />
    </div>

    <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10 relative z-10">
      <div className="text-center">
        <p className="text-[7px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">Fulfillment</p>
        <p className="text-xs font-black italic tracking-tighter text-white">99.8%</p>
      </div>
      <div className="text-center border-x border-white/5">
        <p className="text-[7px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">Dispatch</p>
        <p className="text-xs font-black italic tracking-tighter text-white">2.4h AVG</p>
      </div>
      <div className="text-center">
        <p className="text-[7px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">Trades</p>
        <p className="text-xs font-black italic tracking-tighter text-white">412 SECURED</p>
      </div>
    </div>
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
  const [timeLeft, setTimeLeft] = useState("02:14:55")
  const [showSoldOutSizes, setShowSoldOutSizes] = useState(true)
  const [uiToast, setUiToast] = useState("")

  useEffect(() => {
    // ⏳ Dynamic Urgency Countdown Logic
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + 2);
    targetDate.setMinutes(targetDate.getMinutes() + 14);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft("00:00:00");
        return;
      }

      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchProduct()
  }, [productId])

  useEffect(() => {
    if (!uiToast) return
    const timer = setTimeout(() => setUiToast(""), 2200)
    return () => clearTimeout(timer)
  }, [uiToast])

  const fetchProduct = async () => {
    const { data, error } = await (supabase as any)
      .from("products")
      .select(`*, profiles!products_user_id_fkey(username, avatar_url)`)
      .eq("id", productId)
      .single()

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
      const { data: wish } = await (supabase as any)
        .from("wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .single()
      setInWishlist(!!wish)
    }

    if (data.category) {
      const { data: related } = await (supabase as any)
        .from("products")
        .select("id, title, price, image_url, views, stock, profiles!products_user_id_fkey(username)")
        .eq("category", data.category)
        .neq("id", productId)
        .limit(4)
      if (related) setRelatedProducts(related)
    }

    const { data: variantData } = await (supabase as any).from("product_variants").select("*").eq("product_id", productId)
    if (variantData && variantData.length > 0) {
      setVariants(variantData)
      if (variantData[0].color) setSelectedColor(variantData[0].color)
    }
  }

  const addToWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUiToast("Please login to save")
      setTimeout(() => router.push("/login"), 1500)
      return
    }
    
    if (inWishlist) {
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId)
      if (!error) {
        setInWishlist(false)
        setUiToast("Removed from wishlist")
      }
    } else {
      const { error } = await supabase
        .from("wishlist")
        .insert({ user_id: user.id, product_id: productId } as any)
      if (!error) {
        setInWishlist(true)
        setUiToast("Added to wishlist ❤️")
      }
    }
  }

  const getPriceForVariant = (size: string, color?: string) => {
    if (variants.length === 0) return product?.price || 0
    return variants.find(v => v.size === size && (!color || v.color === color))?.price || product?.price || 0
  }

  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]
  const sizeMap = variants.reduce<Map<string, { size: string; stock: number }>>((acc, v) => {
    const size = String(v.size || "").toUpperCase()
    if (!size) return acc

    const current = acc.get(size)
    if (current) {
      current.stock += Number(v.stock || 0)
    } else {
      acc.set(size, { size, stock: Number(v.stock || 0) })
    }
    return acc
  }, new Map<string, { size: string; stock: number }>())

  const sizeOptions = Array.from<{ size: string; stock: number }>(
    sizeMap.values()
  ).sort((a: { size: string; stock: number }, b: { size: string; stock: number }) => {
    const aIdx = SIZE_ORDER.indexOf(a.size.toUpperCase())
    const bIdx = SIZE_ORDER.indexOf(b.size.toUpperCase())
    if (aIdx === -1 && bIdx === -1) return a.size.localeCompare(b.size)
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })

  const visibleSizeOptions = showSoldOutSizes ? sizeOptions : sizeOptions.filter(v => v.stock > 0)
  const selectedSizeStock = selectedSize
    ? sizeOptions.find(v => v.size === selectedSize)?.stock ?? 0
    : 0
  
  // If no variants, use product stock directly
  const hasVariants = variants.length > 0
  const productStock = product?.stock || 0
  const canPurchase = hasVariants 
    ? !!selectedSize && selectedSizeStock > 0
    : productStock > 0

  const addToCart = async () => {
    // Check size selection only if variants exist
    if (hasVariants && !selectedSize) {
      setUiToast("Please select a size")
      return
    }
    if (hasVariants && selectedSizeStock <= 0) {
      setUiToast("Selected size is out of stock")
      return
    }
    if (!hasVariants && productStock <= 0) {
      setUiToast("Product is out of stock")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUiToast("Please login to add to cart")
      setTimeout(() => router.push("/login"), 1500)
      return
    }

    const variantPrice = hasVariants ? getPriceForVariant(selectedSize!, selectedColor || undefined) : product.price

    // Check if already in cart (Supabase)
    let query = supabase
      .from("carts")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", productId)
    
    // Handle size filter - use .is() for null, .eq() for value
    if (selectedSize) {
      query = query.eq("size", selectedSize)
    } else {
      query = query.is("size", null)
    }
    
    const { data: existingCart, error: queryError } = await query.single()

    if (existingCart && !queryError) {
      // Update quantity - MUST await!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = (supabase.from("carts") as any)
        .update({ quantity: existingCart.quantity + quantity })
        .eq("id", existingCart.id)
      
      if (updateError) {
        setUiToast("Failed to update cart")
      } else {
        setUiToast(`Updated quantity to ${existingCart.quantity + quantity}`)
      }
    } else {
      // Add new
      const { error: insertError } = await supabase
        .from("carts")
        .insert({
          user_id: user.id,
          product_id: productId,
          size: selectedSize || null,
          color: selectedColor || null,
          quantity: quantity,
          seller_id: product.user_id
        } as any)
      
      if (insertError) {
        setUiToast("Failed to add to cart")
      } else {
        setUiToast(`Added ${quantity} to cart`)
      }
    }

    window.dispatchEvent(new Event("hstnlx-cart-updated"))
  }

  const buyNow = async () => {
    await addToCart()
    if (canPurchase) router.push("/cart")
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

  const productAttributes = (product?.model_info?.attributes || {}) as {
    material?: string
    pattern?: string
    sleeveType?: string
    neckline?: string
    occasion?: string
    washCare?: string
  }
  const shippingInfo = (product?.model_info?.shipping || {}) as {
    dispatchHours?: number
    returnWindowDays?: number
    packageWeight?: number
    codEnabled?: boolean
  }

  return (
    <div className="min-h-screen bg-white text-black selection:bg-primary selection:text-black overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 lg:py-20">
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
            </div>

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
                  {product.views > 100 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full border border-orange-100 animate-bounce">
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-600">Trending 🔥</span>
                    </div>
                  )}
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-[0.9] break-words text-balance">
                  {product.title}
                </h1>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline flex-wrap gap-4">
                    <span className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter text-black">₹{product.price?.toLocaleString()}</span>
                    <span className="text-lg sm:text-xl lg:text-2xl text-gray-300 line-through font-bold tracking-tighter">₹{(product.price * 1.6).toLocaleString()}</span>
                    <span className="bg-primary text-black px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">40% OFF PROTOCOL</span>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Institutional Grade Assets | Value Anchored Drop</p>
                </div>

                {/* 👥 REAL-TIME SOCIAL PROOF */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full">
                    <span className="text-xs text-primary">⭐</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">4.9/5 Trust Grade (42 Reviews)</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 border border-black/5 rounded-full">
                    <span className="text-xs">⚡</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-800">12 SECURED IN LAST 24H</span>
                  </div>
                </div>

                {/* ⏳ PSYCHOLOGICAL URGENCY HUB */}
                <div className="p-6 bg-red-600 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group/urgency">
                  <div className="absolute top-0 right-0 p-6 opacity-10 text-6xl pointer-events-none group-hover/urgency:scale-125 transition-transform duration-1000">⏳</div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-100 mb-1">Institutional Session Ending</p>
                      <p className="text-lg font-black italic tracking-tighter uppercase">Flash Drop Availability</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-right">
                      <p className="text-2xl font-black tabular-nums tracking-tighter">{timeLeft}</p>
                      <p className="text-[7px] font-black uppercase tracking-widest text-red-100">Protocol Close</p>
                    </div>
                  </div>
                </div>

                {product.stock <= 5 && product.stock > 0 && (
                  <div className="p-4 bg-orange-50 border-2 border-orange-100 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in-95">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white text-xl animate-bounce">🔥</div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-orange-600">Critical Supply Shortage</p>
                      <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Only {product.stock} pieces remaining in archival vault.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Viewer Analytics Context */}
              <div className="p-5 bg-black rounded-[2.5rem] text-white flex items-center justify-between border-b-4 border-primary shadow-2xl group/analytics overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover/analytics:scale-150 transition-transform duration-1000">📊</div>
                <div className="relative z-10">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-1">Live Velocity Tracking</p>
                  <p className="text-sm font-bold italic tracking-tight uppercase">{product.stock > 10 ? 'High Liquidity Drop' : 'Critical Asset Shortage'}</p>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-2xl font-black italic tracking-tighter text-white">{viewersCount}</p>
                  <p className="text-[7px] font-black uppercase tracking-widest text-primary">Active Sessions</p>
                </div>
              </div>
            </div>

            {/* Sizing Matrix */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 flex items-center gap-2">
                  Size Selection <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setShowSoldOutSizes(v => !v)}
                    className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4 hover:text-primary transition-colors"
                  >
                    {showSoldOutSizes ? "Hide Sold Out" : "Show Sold Out"}
                  </button>
                  <button onClick={() => setShowSizeGuide(true)} className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4 hover:text-primary transition-colors">Dimension Grid</button>
                </div>
              </div>

              {visibleSizeOptions.length > 0 ? (
                <div className="grid grid-cols-5 gap-3">
                  {visibleSizeOptions.map(v => (
                    <button
                      key={v.size}
                      onClick={() => {
                        if (v.stock <= 0) {
                          setUiToast(`Size ${v.size} is sold out`)
                          return
                        }
                        setSelectedSize(v.size)
                      }}
                      className={`group relative h-16 rounded-2xl font-black transition-all duration-500 border-2 ${selectedSize === v.size
                        ? 'bg-black text-white border-black shadow-[0_20px_40px_rgba(0,0,0,0.15)] scale-105'
                        : v.stock > 0
                          ? 'bg-white border-gray-100 hover:border-black text-gray-400 hover:text-black'
                          : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                    >
                      <span className="relative z-10">{v.size}</span>
                      {selectedSize === v.size && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full ring-4 ring-white" />
                      )}
                      {v.stock <= 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-red-500 text-xl font-black">✕</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-16 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">No sizes configured by seller</span>
                </div>
              )}
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 text-center italic">
                {sizeOptions.length > 0 ? `${sizeOptions.filter(v => v.stock > 0).length} sizes available` : 'Waiting for seller size setup'}
              </p>

              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 mt-4">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Unit Deployment</span>
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:border-black transition-colors"
                  >
                    <span className="text-xl font-bold">−</span>
                  </button>
                  <span className="text-lg font-black italic tracking-tighter w-4 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:border-black transition-colors"
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={buyNow}
                disabled={!canPurchase}
                className={`group w-full h-24 rounded-[2rem] font-black uppercase tracking-[0.4em] text-sm transition-all duration-700 relative overflow-hidden flex items-center justify-center ${canPurchase
                  ? 'bg-black text-white hover:bg-primary hover:text-black shadow-2xl'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed grayscale'
                  }`}
              >
                <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 flex items-center gap-4 group-hover:scale-110 transition-transform">
                  ⚡ EXECUTE FLASH BUY <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                </span>
              </button>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={addToCart}
                  disabled={!canPurchase}
                  className={`h-22 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all group ${canPurchase
                    ? 'border-black hover:bg-black hover:text-white'
                    : 'border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                >
                  ARCHIVE TO BAG
                </button>
                <button
                  onClick={addToWishlist}
                  className={`h-22 rounded-2xl border-2 transition-all flex items-center justify-center text-xl group ${inWishlist ? 'bg-red-500 border-red-500 text-white' : 'border-gray-100 hover:text-red-500'
                    }`}
                >
                  {inWishlist ? '❤️' : '♡'}
                </button>
              </div>
            </div>

            {/* 🏷️ STICKY MOBILE CTA BAR (INSTITUTIONAL STANDARD) */}
            <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-[100] p-4 bg-white/80 backdrop-blur-2xl border-t border-gray-100 transition-transform duration-500 ${canPurchase ? 'translate-y-0' : 'translate-y-full'}`}>
              <div className="flex gap-4 max-w-lg mx-auto">
                <div className="flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Selected: {selectedSize}</p>
                  <p className="text-xl font-black italic tracking-tighter">₹{product.price?.toLocaleString()}</p>
                </div>
                <button
                  onClick={buyNow}
                  className="flex-[2] h-14 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl active:scale-95 transition-all"
                >
                  ⚡ SECURE NOW
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 py-10 border-y border-gray-100">
              {[
                { label: '100% Authentic', icon: '🛡️', color: 'text-blue-500' },
                { label: 'Secure Escrow', icon: '🔐', color: 'text-green-500' },
                { label: 'Insured Transit', icon: '✈️', color: 'text-primary' }
              ].map((t, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-3 group/badge">
                  <span className={`text-2xl transition-transform duration-500 group-hover/badge:scale-125 ${t.color}`}>{t.icon}</span>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">{t.label}</span>
                </div>
              ))}
            </div>

            {/* 🛡️ INSTITUTIONAL PROTECTION PROTOCOL */}
            <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-6 relative overflow-hidden group/trust">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl pointer-events-none group-hover/trust:scale-110 transition-transform duration-1000">🛡️</div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-lg">⚖️</div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Institutional Protection</h4>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Global Trade Standard Alpha-7</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  { title: '7-Day Return Logic', desc: 'Full refund if the asset does not match description.', icon: '🔄' },
                  { title: 'HSTNLX Escrow Tier', desc: 'Secure vault holding until delivery confirmation.', icon: '🏦' },
                  { title: 'QA Forensic Check', desc: 'Institutional grade verification for every drop.', icon: '🔍' }
                ].map((p, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-black transition-all group/item">
                    <span className="text-xl group-hover/item:scale-125 transition-transform">{p.icon}</span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{p.title}</p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SellerCard profile={product.profiles} userId={product.user_id} />

            <div className="space-y-8">
              <div className="flex gap-10 border-b border-gray-100">
                {['description', 'specifications', 'shipping'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-[10px] font-black uppercase tracking-[0.3em] relative transition-colors ${activeTab === tab ? 'text-black' : 'text-gray-300 hover:text-black'
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
                {activeTab === 'description' && (
                  <p className="text-sm font-bold uppercase tracking-tight italic text-gray-700 leading-relaxed text-pretty">
                    {product.description}
                  </p>
                )}

                {activeTab === 'specifications' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Material', value: productAttributes.material || 'Institutional-grade blend' },
                      { label: 'Pattern', value: productAttributes.pattern || 'Standard finish' },
                      { label: 'Sleeve', value: productAttributes.sleeveType || 'Standard sleeve profile' },
                      { label: 'Neckline', value: productAttributes.neckline || 'Category standard' },
                      { label: 'Occasion', value: productAttributes.occasion || 'Daily + elevated wear' },
                      { label: 'Wash Care', value: productAttributes.washCare || 'Gentle machine wash' },
                    ].map((item) => (
                      <div key={item.label} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</p>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-700">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Dispatch', value: shippingInfo.dispatchHours ? `${shippingInfo.dispatchHours}h protocol` : '24h protocol' },
                      { label: 'Return Window', value: shippingInfo.returnWindowDays ? `${shippingInfo.returnWindowDays} days` : '7 days' },
                      { label: 'Package Weight', value: shippingInfo.packageWeight ? `${shippingInfo.packageWeight} kg` : 'Standard' },
                      { label: 'COD', value: typeof shippingInfo.codEnabled === 'boolean' ? (shippingInfo.codEnabled ? 'Available' : 'Unavailable') : 'Available' },
                      { label: 'Transit', value: 'Secured Transit Insurance Included' },
                    ].map((item) => (
                      <div key={item.label} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</p>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-700">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PhotoReviews productId={productId} />

      {relatedProducts.length > 0 && (
        <div className="mt-20 md:mt-40 pt-16 md:pt-40 border-t border-gray-100 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6 mb-10 md:mb-16">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Discover More</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black italic uppercase tracking-tighter mt-3 md:mt-4">Linked Archives</h2>
            </div>
            <Link href="/" className="text-xs font-black uppercase tracking-[0.3em] border-b-2 border-black pb-2 hover:text-primary hover:border-primary transition-all">Explore Entire Fleet →</Link>
          </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 lg:gap-12">
              {relatedProducts.map(p => (<ProductCard key={p.id} product={p} />))}
            </div>
          </div>
        </div>
      )}
      <SizeGuide isOpen={showSizeGuide} onClose={() => setShowSizeGuide(false)} />
      <div className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-[160] transition-all duration-300 ${uiToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <div className="px-5 py-2.5 rounded-full bg-black text-white text-[11px] font-black uppercase tracking-wider shadow-2xl border border-white/10">
          {uiToast}
        </div>
      </div>
    </div>
  )
}
