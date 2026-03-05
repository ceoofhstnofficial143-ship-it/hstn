"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function WishlistPage() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchWishlist()
    }, [])

    const fetchWishlist = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            setLoading(false)
            return
        }

        const { data, error } = await supabase
            .from("wishlist")
            .select(`
        id,
        product_id,
        products (
          id,
          title,
          price,
          description,
          image_url,
          user_id,
          category
        )
      `)
            .eq("user_id", session.user.id)

        if (!error && data) {
            setItems(data)
        }

        setLoading(false)
    }

    const removeItem = async (id: string) => {
        const { error } = await supabase.from("wishlist").delete().eq("id", id)
        if (!error) {
            setItems(items.filter(item => item.id !== id))
        }
    }

    const handleAddToCart = (product: any) => {
        const cart = JSON.parse(localStorage.getItem("hstn-cart") || "[]")
        const exists = cart.find((item: any) => item.id === product.id)
        if (exists) {
            exists.quantity = (exists.quantity || 1) + 1
        } else {
            cart.push({ ...product, quantity: 1 })
        }
        localStorage.setItem("hstn-cart", JSON.stringify(cart))
        window.dispatchEvent(new Event("hstn-cart-updated"))
        alert("Added to cart 🛒")
    }

    if (loading) return (
        <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
    )

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">Saved <span className="text-red-500">Vault.</span></h1>
                    <p className="text-slate-400 font-medium">Curate your collection of premium finds and future acquisitions.</p>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <div className="px-6 py-2 bg-white rounded-xl shadow-sm font-bold text-slate-900 text-sm">{items.length} {items.length === 1 ? 'Object' : 'Objects'} Saved</div>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-32 bg-white rounded-[40px] shadow-sm border border-slate-50">
                    <span className="text-6xl mb-6 block opacity-20">🕳️</span>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Vault is empty</h2>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">Scout the marketplace to find high-value assets to add to your collection.</p>
                    <Link href="/">
                        <button className="bg-black text-white px-10 py-4 rounded-2xl font-black hover:bg-gray-800 transition-premium shadow-xl active:scale-95">
                            Begin Scouting
                        </button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                    {items.map((item) => {
                        const product = item.products
                        if (!product) return null

                        return (
                            <div
                                key={item.id}
                                className="group relative bg-white border border-slate-100 rounded-[32px] p-5 shadow-premium shadow-premium-hover transition-premium flex flex-col h-full overflow-hidden"
                            >
                                {/* Product Image Wrapper */}
                                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden mb-6 bg-slate-50">
                                    <Link href={`/products/${product.id}`} className="absolute inset-0 z-10" />

                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300 italic">
                                            No preview available
                                        </div>
                                    )}

                                    {/* Remove Button Overlay */}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            removeItem(item.id);
                                        }}
                                        className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/90 backdrop-blur shadow-sm rounded-full flex items-center justify-center hover:bg-red-50 transition-colors pointer-events-auto group/trash active:scale-90"
                                        title="Remove from Vault"
                                    >
                                        <span className="text-lg group-hover/trash:scale-110 transition-transform">🗑️</span>
                                    </button>

                                    <div className="absolute bottom-4 left-4 z-20 px-3 py-1 bg-black/50 backdrop-blur rounded-full text-[10px] font-bold text-white uppercase tracking-widest">
                                        {product.category}
                                    </div>
                                </div>

                                <div className="flex flex-col flex-1 relative z-10">
                                    <div className="flex justify-between items-start mb-3">
                                        <h2 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 pr-4">
                                            {product.title}
                                        </h2>
                                        <span className="text-lg font-black text-slate-900 whitespace-nowrap">
                                            ₹{product.price.toLocaleString()}
                                        </span>
                                    </div>

                                    <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed mb-8 flex-1">
                                        {product.description}
                                    </p>

                                    <div className="flex gap-3 pt-6 border-t border-slate-50">
                                        <button
                                            onClick={() => handleAddToCart(product)}
                                            className="flex-1 bg-black text-white px-4 py-3 rounded-xl font-black hover:bg-gray-800 transition-premium shadow-lg active:scale-95 text-sm"
                                        >
                                            Acquire Now
                                        </button>
                                        <Link href={`/products/${product.id}`} className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-slate-100 transition-colors">
                                            →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
