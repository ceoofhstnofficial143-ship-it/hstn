"use client"

import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getTrustTier } from "@/lib/trustTier"
import SimplePurchaseRequestButton from "@/components/SimplePurchaseRequestButton"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function ProductPage() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string
    const [product, setProduct] = useState<any>(null)
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [displayScore, setDisplayScore] = useState(0)

    const [fullName, setFullName] = useState("")
    const [phone, setPhone] = useState("")
    const [address, setAddress] = useState("")
    const [city, setCity] = useState("")
    const [pincode, setPincode] = useState("")

    const [averageRating, setAverageRating] = useState(0)
    const [soldToday, setSoldToday] = useState(0)
    const [viewing, setViewing] = useState(0)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [showVideoModal, setShowVideoModal] = useState(false)
    const [touchStart, setTouchStart] = useState(0)
    const [touchEnd, setTouchEnd] = useState(0)

    // Review state
    const [reviews, setReviews] = useState<any[]>([])
    const [newReview, setNewReview] = useState({ rating: 5, comment: "", photo_url: "" })
    const [submittingReview, setSubmittingReview] = useState(false)

    useEffect(() => {
        const run = async () => {
            if (!id) return
            const { data: p } = await supabase
                .from("products")
                .select("*")
                .eq("id", id)
                .single()

            if (p) {
                const { data: trust } = await supabase
                    .from("trust_scores")
                    .select("score, verified")
                    .eq("user_id", p.user_id)
                    .single()
                setProduct({ ...p, trust })

                // Fetch real reviews
                const { data: revs } = await supabase
                    .from("reviews")
                    .select("*")
                    .eq("product_id", id)
                    .order("created_at", { ascending: false })

                if (revs) {
                    setReviews(revs)
                    if (revs.length > 0) {
                        const total = revs.reduce((sum, r) => sum + r.rating, 0)
                        setAverageRating(total / revs.length)
                    } else {
                        setAverageRating(0)
                    }
                }

                // Placeholder data for social proof and urgency
                setSoldToday(Math.floor(Math.random() * 500) + 100)
                setViewing(Math.floor(Math.random() * 20) + 5)
            }

            const { data: { user: u } } = await supabase.auth.getUser()
            setUser(u ?? null)
            setLoading(false)
            // Force scroll to top of protocol
            window.scrollTo(0, 0)
        }
        run()
    }, [id])

    useEffect(() => {
        if (product?.trust?.score) {
            let start = 0
            const end = product.trust.score
            const duration = 1500
            const increment = end / (duration / 16)

            const timer = setInterval(() => {
                start += increment
                if (start >= end) {
                    setDisplayScore(end)
                    clearInterval(timer)
                } else {
                    setDisplayScore(Math.floor(start))
                }
            }, 16)
            return () => clearInterval(timer)
        }
    }, [product?.trust?.score])

    const handleAddToCart = () => {
        const cart = JSON.parse(localStorage.getItem("hstn-cart") || "[]")
        const exists = cart.find((item: any) => item.id === product.id)
        if (exists) {
            exists.quantity += 1
        } else {
            cart.push({ ...product, quantity: 1 })
        }
        localStorage.setItem("hstn-cart", JSON.stringify(cart))
        alert("Added to your acquisitions bag 🛍️")
        router.refresh()
    }

    const handleSaveForLater = () => {
        alert("Saved for later ♥")
    }

    const handleOrder = async () => {
        if (!user) {
            router.push("/login")
            return
        }
        if (!fullName || !phone || !address || !city || !pincode) {
            alert("Please fill all shipping fields")
            return
        }

        const { error } = await supabase.rpc("place_order_with_stock", {
            p_product_id: product.id,
            p_full_name: fullName,
            p_phone: phone,
            p_address: address,
            p_city: city,
            p_pincode: pincode,
        })

        if (error) {
            alert(error.message)
            return
        }

        alert("Order placed successfully 🎉")
        router.push("/orders")
    }

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            router.push("/login")
            return
        }
        setSubmittingReview(true)

        const { data, error } = await supabase
            .from("reviews")
            .insert([
                {
                    product_id: id,
                    user_id: user.id,
                    rating: newReview.rating,
                    comment: newReview.comment,
                    photo_url: newReview.photo_url,
                    user_name: user.email?.split('@')[0] || "Anonymous"
                }
            ])
            .select()

        if (error) {
            alert(`Review failed: ${error.message}`)
        } else {
            if (data) setReviews([data[0], ...reviews])
            setNewReview({ rating: 5, comment: "", photo_url: "" })
            alert("Review published to the gallery.")
        }
        setSubmittingReview(false)
    }

    const handleReviewPhotoUpload = async (file: File) => {
        if (!file) return
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `review-photos/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('product-images') // Reusing for MVP
            .upload(filePath, file)

        if (uploadError) {
            alert("Photo upload failed")
            return
        }

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

        setNewReview(prev => ({ ...prev, photo_url: publicUrl }))
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <h2 className="text-h2 mb-4">Product Not Found</h2>
                <Link href="/products" className="luxury-button">Back to Gallery</Link>
            </div>
        )
    }

    const tier = product ? getTrustTier(product.trust?.score) : { name: "Probation", icon: "⚪", label: "New Seller", badgeClass: "" }

    // Get all images including additional_images
    const allImages = product ? [product.image_url, ...(product.additional_images || [])].filter(Boolean) : []

    // Touch swipe handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(0)
        setTouchStart(e.targetTouches[0].clientX)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX)
    }

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return
        
        const distance = touchStart - touchEnd
        const isLeftSwipe = distance > 50
        const isRightSwipe = distance < -50

        if (isLeftSwipe && currentImageIndex < allImages.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1)
        }
        if (isRightSwipe && currentImageIndex > 0) {
            setCurrentImageIndex(currentImageIndex - 1)
        }
    }

    return (
        <>
        <main className="bg-background min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">

                {/* Back Navigation */}
                <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-8 transition-colors">
                    ← Back to Collection
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                    {/* LEFT: Image Gallery with Carousel */}
                    <div className="space-y-4">
                        {/* Main Image Carousel */}
                        <div 
                            className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 group"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            {allImages.length > 0 ? (
                                <>
                                    <img
                                        src={allImages[currentImageIndex]}
                                        alt={`${product.title} - Photo ${currentImageIndex + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-500"
                                    />
                                    
                                    {/* Navigation Arrows */}
                                    {allImages.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setCurrentImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-gray-800" />
                                            </button>
                                            <button
                                                onClick={() => setCurrentImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <ChevronRight className="w-5 h-5 text-gray-800" />
                                            </button>
                                        </>
                                    )}
                                    
                                    {/* Image Counter */}
                                    {allImages.length > 1 && (
                                        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                                            {currentImageIndex + 1} / {allImages.length}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <img
                                    src={product.image_url}
                                    alt={product.title}
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        
                        {/* Thumbnail Strip - Swipeable */}
                        {allImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
                                {allImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all snap-center ${
                                            idx === currentImageIndex ? 'border-black' : 'border-gray-200 hover:border-gray-400'
                                        }`}
                                    >
                                        <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Video Button */}
                        {product.video_url && (
                            <button
                                onClick={() => setShowVideoModal(true)}
                                className="w-full aspect-video rounded-xl bg-black flex items-center justify-center hover:bg-gray-900 transition-colors group"
                            >
                                <div className="text-white text-center">
                                    <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium">View Verification Video</p>
                                </div>
                            </button>
                        )}

                        {/* Trust Score Card */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">Trust Score</h3>
                            <div className="flex items-end gap-4 mb-4">
                                <span className="text-4xl font-bold text-gray-900">{displayScore}</span>
                                <span className="text-gray-500">/ 100</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                                <div
                                    className="bg-black h-2 rounded-full transition-all duration-1000"
                                    style={{ width: `${product.trust?.score ?? 0}%` }}
                                />
                            </div>
                            <div className="text-xs text-gray-600">
                                <span className="font-semibold">{tier.label}</span> • Verified Seller
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Product Info */}
                    <div className="space-y-6">
                        {/* Category & Title */}
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
                                {product.category || "Fashion"}
                            </span>
                            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">{product.title}</h1>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-1">
                                    <span>⭐</span>
                                    <span>{averageRating.toFixed(1)} ({reviews.length} reviews)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>✔</span>
                                    <span>{soldToday} sold today</span>
                                </div>
                                {averageRating > 4.5 && reviews.length > 10 && <div className="flex items-center gap-1 text-red-600 font-medium">
                                    <span>🔥</span>
                                    <span>Trending in Gen-Z Fashion</span>
                                </div>}
                            </div>
                        </div>

                        {/* Price */}
                        <div className="text-3xl font-bold text-gray-900">
                            ₹{product.price.toLocaleString()}
                        </div>

                        <div className="space-y-1 pt-2">
                            <div className="flex items-center gap-1 text-sm text-red-600 font-medium">
                                <span>🔥</span>
                                <span>{viewing} people viewing this item</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-orange-600 font-medium">
                                <span>⏳</span>
                                <span>Only {product.stock} left in stock</span>
                            </div>
                        </div>

                        {/* Trust Badge */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Seller Trust:</span>
                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${tier.badgeClass}`}>
                                <span>{tier.icon}</span> {tier.label}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="text-gray-600 leading-relaxed">
                            {product.description || "Premium fashion piece with verified authenticity and quality craftsmanship."}
                        </div>

                        {/* Size Info */}
                        {product.measurements && Object.values(product.measurements).some(v => v) && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Measurements</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries((product.measurements as Record<string, string>) || {}).map(([key, val]) => (
                                        val && (
                                            <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                                                <div className="text-xs text-gray-500 uppercase tracking-wide">{key}</div>
                                                <div className="text-sm font-semibold text-gray-900">{val} cm</div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Purchase Buttons */}
                        <div className="space-y-3 pt-6">
                            <button
                                onClick={handleOrder}
                                className="luxury-button w-full min-h-[44px]"
                            >
                                Buy Now
                            </button>

                            <button
                                onClick={handleAddToCart}
                                className="w-full h-11 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Add to Cart
                            </button>

                            <button
                                onClick={handleSaveForLater}
                                className="w-full h-11 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            >
                                ♥ Save for Later
                            </button>
                        </div>

                        {/* Trust Triggers */}
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-4">
                            <span>✔ Free returns</span>
                            <span>✔ Secure payment</span>
                            <span>✔ Fast shipping</span>
                        </div>
                    </div>

                </div>

                {/* Reviews Section */}
                {reviews.length > 0 && (
                    <div className="mt-16 pt-8 border-t">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Reviews ({reviews.length})</h3>
                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <div key={review.id} className="bg-white rounded-lg p-4 shadow-sm border">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex text-yellow-400">
                                            {"★★★★★".slice(0, review.rating).split("").map((s, i) => <span key={i}>{s}</span>)}
                                        </div>
                                        <span className="text-sm text-gray-600">{review.rating}/5</span>
                                    </div>
                                    <p className="text-gray-700">{review.comment}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Mobile Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden">
                <div className="flex gap-2">
                    <button
                        onClick={handleSaveForLater}
                        className="flex-1 h-12 border border-gray-300 text-gray-700 font-semibold rounded-lg flex items-center justify-center gap-2"
                    >
                        ♥ Save
                    </button>
                    <button
                        onClick={handleAddToCart}
                        className="flex-1 h-12 bg-gray-100 text-gray-900 font-semibold rounded-lg flex items-center justify-center"
                    >
                        Add Cart
                    </button>
                    <button
                        onClick={handleOrder}
                        className="flex-1 h-12 luxury-button min-h-[44px]"
                    >
                        Buy Now
                    </button>
                </div>
            </div>
        </main>

        {/* Video Modal */}
        {showVideoModal && product.video_url && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowVideoModal(false)}>
                <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-black rounded-xl overflow-hidden">
                        <div className="flex justify-between items-center p-4 bg-gray-900">
                            <h3 className="text-white font-semibold">Verification Video</h3>
                            <button
                                onClick={() => setShowVideoModal(false)}
                                className="text-white hover:text-gray-300 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <video
                            src={product.video_url}
                            className="w-full max-h-[70vh] object-contain"
                            controls
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    </div>
                </div>
            </div>
        )}
    </>
    )
}
