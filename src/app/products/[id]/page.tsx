"use client"

import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getTrustTier } from "@/lib/trustTier"
import SimplePurchaseRequestButton from "@/components/SimplePurchaseRequestButton"

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

                if (revs) setReviews(revs)
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

    return (
        <main className="bg-background min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Back Navigation */}
                <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-8 transition-colors">
                    ← Back to Collection
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                    {/* LEFT: Image Gallery */}
                    <div className="space-y-6">
                        {/* Main Image */}
                        <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                            <img
                                src={product.image_url}
                                alt={product.title}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Video if available */}
                        {product.video_url && (
                            <div className="aspect-video overflow-hidden rounded-xl bg-black">
                                <video
                                    src={product.video_url}
                                    className="w-full h-full object-cover"
                                    controls
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            </div>
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
                        </div>

                        {/* Price */}
                        <div className="text-3xl font-bold text-gray-900">
                            ₹{product.price.toLocaleString()}
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
                            <SimplePurchaseRequestButton product={product} user={user} />

                            <button
                                onClick={handleAddToCart}
                                className="w-full h-11 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Add to Cart
                            </button>
                        </div>

                        {/* Stock Status */}
                        <div className="text-sm text-gray-600">
                            {product.stock > 0 ? (
                                <span className="text-green-600 font-semibold">{product.stock} in stock</span>
                            ) : (
                                <span className="text-red-600 font-semibold">Out of stock</span>
                            )}
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
        </main>
    )
}
