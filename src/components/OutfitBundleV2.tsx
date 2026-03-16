"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"
import ProductCard from "./ProductCard"

interface OutfitBundleV2Props {
    bundleId?: string
    limit?: number
}

export default function OutfitBundleV2({ bundleId, limit = 1 }: OutfitBundleV2Props) {
    const [bundles, setBundles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchBundles = async () => {
            setLoading(true)
            let query = supabase
                .from("outfit_bundles")
                .select("*")
            
            if (bundleId) {
                query = query.eq("id", bundleId)
            } else {
                query = query.limit(limit)
            }

            const { data: bundleData, error: bundleError } = await query
            
            if (bundleError || !bundleData) {
                setLoading(false)
                return
            }

            const bundlesWithProducts = await Promise.all(
                bundleData.map(async (bundle) => {
                    const { data: products, error: productsError } = await supabase
                        .from("products")
                        .select("*")
                        .in("id", bundle.product_ids)
                        .eq("admin_status", "approved")
                    
                    return { ...bundle, products: products || [] }
                })
            )

            setBundles(bundlesWithProducts)
            setLoading(false)
        }

        fetchBundles()
    }, [bundleId, limit])

    if (loading || bundles.length === 0) return null

    return (
        <div className="space-y-12">
            {bundles.map((bundle) => {
                const totalOriginalPrice = bundle.products.reduce((sum: number, p: any) => sum + (p.price || 0), 0)
                const discountAmount = totalOriginalPrice * (bundle.discount_percentage / 100)
                const bundlePrice = Math.round(totalOriginalPrice - discountAmount)

                return (
                    <section key={bundle.id} className="luxury-card bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 pointer-events-none">
                            <span className="text-4xl md:text-8xl italic font-black uppercase tracking-tighter">BUNDLE</span>
                        </div>

                        <header className="mb-6 md:mb-8 relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">Aesthetic Synthesis</span>
                            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic mt-2">{bundle.title}</h2>
                            <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">{bundle.description || "The complete protocol for a synchronized aesthetic."}</p>
                        </header>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10 relative z-10">
                            {bundle.products.map((product: any) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 md:pt-8 border-t border-gray-50 relative z-10">
                            <div className="text-center md:text-left w-full md:w-auto">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1 line-through opacity-60">
                                    ₹{totalOriginalPrice.toLocaleString()}
                                </p>
                                <div className="flex items-center gap-3 md:gap-4 justify-center md:justify-start">
                                    <p className="text-3xl md:text-4xl font-black text-purple-600 tracking-tighter italic">
                                        ₹{bundlePrice.toLocaleString()}
                                    </p>
                                    <span className="bg-purple-100 text-purple-600 text-[9px] md:text-[10px] font-black px-2 md:px-3 py-1 rounded-full uppercase tracking-widest">
                                        Save {bundle.discount_percentage}%
                                    </span>
                                </div>
                            </div>
                            
                            <button className="w-full md:w-auto bg-black text-white px-8 md:px-12 py-4 md:py-5 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-[11px] hover:bg-purple-600 transition-all shadow-xl shadow-purple-50 active:scale-95">
                                Acquire Complete Look ⚡
                            </button>
                        </div>
                    </section>
                )
            })}
        </div>
    )
}
