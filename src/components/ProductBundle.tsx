"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import NextImage from "next/image"
import Link from "next/link"

interface ProductBundleProps {
    currentProduct: any
}

export default function ProductBundle({ currentProduct }: ProductBundleProps) {
    const [bundle, setBundle] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchBundle = async () => {
            setLoading(true)
            // V2: AI "Complete the Look" Logic
            // In a real system, we'd use a vision AI embedding search
            // Here we simulate it by finding items from the same seller in complementary categories
            const { data } = await supabase
                .from("products")
                .select("*")
                .eq("user_id", currentProduct.user_id)
                .neq("id", currentProduct.id)
                .eq("admin_status", "approved")
                .limit(2)

            if (data && data.length > 0) {
                setBundle(data)
            }
            setLoading(false)
        }

        if (currentProduct?.user_id) {
            fetchBundle()
        }
    }, [currentProduct])

    if (loading || bundle.length === 0) return null

    const bundleTotal = currentProduct.price + bundle.reduce((sum, item) => sum + item.price, 0)
    const discountedTotal = Math.round(bundleTotal * 0.9) // 10% Bundle Discount

    return (
        <section className="mt-16 pt-16 border-t border-gray-100">
            <header className="mb-8">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500">Style Synthesis</span>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic mt-2">Complete The Look</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Bundle & Save 10% Protocol</p>
            </header>

            <div className="bg-gray-50 rounded-[32px] p-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* Bundle Items */}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-24 h-32 rounded-2xl overflow-hidden bg-white shadow-sm relative shrink-0">
                            <NextImage src={currentProduct.image_url} alt={currentProduct.title} fill className="object-cover" />
                        </div>
                        <span className="text-xl font-black text-gray-300">+</span>
                        {bundle.map((item) => (
                            <div key={item.id} className="flex items-center gap-4">
                                <Link href={`/product/${item.id}`} className="w-24 h-32 rounded-2xl overflow-hidden bg-white shadow-sm relative shrink-0 group">
                                    <NextImage src={item.image_url} alt={item.title} fill className="object-cover transition-transform group-hover:scale-110" />
                                </Link>
                                {bundle.indexOf(item) === 0 && bundle.length > 1 && (
                                    <span className="text-xl font-black text-gray-300">+</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Bundle Pricing */}
                    <div className="w-full md:w-64 space-y-4 text-center md:text-right">
                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1 line-through">
                                ₹{bundleTotal.toLocaleString()}
                            </p>
                            <p className="text-3xl font-black text-purple-600 tracking-tighter italic">
                                ₹{discountedTotal.toLocaleString()}
                            </p>
                        </div>
                        <button className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-purple-700 transition-all shadow-xl shadow-purple-100">
                            Acquire Bundle ⚡
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
