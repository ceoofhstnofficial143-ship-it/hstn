"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import Image from "next/image"

export default function EditProductPage() {
    const params = useParams()
    const router = useRouter()
    const productId = params.id as string

    const [product, setProduct] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)

    // Form states
    const [title, setTitle] = useState("")
    const [price, setPrice] = useState("")
    const [stock, setStock] = useState("")
    const [category, setCategory] = useState("")
    const [description, setDescription] = useState("")
    const [size, setSize] = useState("")

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) return

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data, error } = await (supabase as any)
                .from("products")
                .select("*")
                .eq("id", productId)
                .eq("user_id", user.id)
                .single()

            if (data) {
                setProduct(data)
                setTitle(data.title)
                setPrice(data.price.toString())
                setStock(data.stock.toString())
                setCategory(data.category || "")
                setDescription(data.description || "")
                setSize(data.model_info?.size || "S")
            } else {
                console.error("Error fetching product:", error)
            }
            setLoading(false)
        }

        fetchProduct()
    }, [productId, router])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setUpdating(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Update Product
        const { error } = await (supabase as any)
            .from("products")
            .update({
                title,
                price: parseFloat(price),
                stock: parseInt(stock),
                category,
                description,
                model_info: {
                    ...product.model_info,
                    size: size
                }
            })
            .eq("id", productId)
            .eq("user_id", user.id)

        if (error) {
            alert(`Update Failed: ${error.message}`)
        } else {
            // 2. Sync Variant
            const { error: variantError } = await (supabase as any)
                .from("product_variants")
                .upsert({
                    product_id: productId,
                    size: size,
                    stock: parseInt(stock),
                    price: parseFloat(price),
                    color: "STANDARD"
                }, { onConflict: 'product_id,size' })

            if (variantError) {
                console.error("Variant synchronization failure:", variantError.message)
            }

            alert("Asset Successfully Synchronized.")
            router.push("/seller/dashboard")
        }
        setUpdating(false)
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    if (!product) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            <h2 className="text-2xl font-black uppercase italic">Asset Not Identified</h2>
            <Link href="/seller/dashboard" className="luxury-button mt-8">Return to Command Center</Link>
        </div>
    )

    return (
        <div className="bg-background min-h-screen pb-20">
            <div className="max-w-3xl mx-auto px-4 py-20">
                <Link href="/seller/dashboard" className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-primary transition-colors flex items-center gap-2 mb-12">
                    ← Back to Dashboard
                </Link>

                <header className="mb-12">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Edit Protocol</span>
                    <h1 className="text-4xl lg:text-5xl font-black italic uppercase tracking-tighter mt-2">Modify Asset</h1>
                    <p className="text-muted text-[10px] uppercase font-bold tracking-widest mt-4 opacity-60">Synchronization ID: {productId}</p>
                </header>

                <form onSubmit={handleUpdate} className="luxury-card bg-white p-8 md:p-12 space-y-8 rounded-[2.5rem] shadow-sm border border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Title */}
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Asset Nomenclature</label>
                            <input
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-accent/5 border border-border rounded-xl px-4 py-4 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        {/* Price */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Value (INR)</label>
                            <input
                                required
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full bg-accent/5 border border-border rounded-xl px-4 py-4 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        {/* Stock */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Inventory Units</label>
                            <input
                                required
                                type="number"
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                className="w-full bg-accent/5 border border-border rounded-xl px-4 py-4 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Aesthetic Classification</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-accent/5 border border-border rounded-xl px-4 py-4 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-colors appearance-none"
                            >
                                <option value="CO-ORD SETS">CO-ORD SETS</option>
                                <option value="TRENDY TOPS">TRENDY TOPS</option>
                                <option value="CASUAL DRESSES">CASUAL DRESSES</option>
                                <option value="KOREAN-STYLE FASHION">KOREAN-STYLE FASHION</option>
                                <option value="ALL">UNCLASSIFIED</option>
                            </select>
                        </div>

                        {/* Size */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Size Classification</label>
                            <select
                                value={size}
                                onChange={(e) => setSize(e.target.value)}
                                className="w-full bg-accent/5 border border-border rounded-xl px-4 py-4 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-primary transition-colors appearance-none"
                            >
                                <option value="XS">XS (Extra Small)</option>
                                <option value="S">S (Small)</option>
                                <option value="M">M (Medium)</option>
                                <option value="L">L (Large)</option>
                                <option value="XL">XL (Extra Large)</option>
                                <option value="XXL">XXL (Double XL)</option>
                            </select>
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Asset Narrative</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                className="w-full bg-accent/5 border border-border rounded-xl px-4 py-4 text-xs font-bold leading-relaxed focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={updating}
                        className="w-full bg-black text-white text-[12px] font-black uppercase tracking-[0.3em] py-6 rounded-2xl hover:bg-primary hover:text-black transition-all duration-500 shadow-xl shadow-black/5 disabled:opacity-50"
                    >
                        {updating ? "Synchronizing..." : "Update Asset Protocol ⚡"}
                    </button>

                    <p className="text-center text-[8px] font-black uppercase tracking-widest text-muted opacity-40">
                        Version 2.0.4 • Merchant Security Protocol Enabled
                    </p>
                </form>
            </div>
        </div>
    )
}
