"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPendingProducts()
    }, [])

    const fetchPendingProducts = async () => {
        setLoading(true)
        const { data, error } = await (supabase as any)
            .from("products")
            .select(`
                *,
                profiles!products_user_id_fkey(username)
            `)
            .eq("admin_status", "pending")
            .order("created_at", { ascending: false })

        if (data) setProducts(data)
        setLoading(false)
    }

    const handleStatusUpdate = async (productId: string, status: 'approved' | 'rejected') => {
        const { error } = await (supabase as any)
            .from("products")
            .update({ admin_status: status })
            .eq("id", productId)

        if (error) {
            alert(`Error: ${error.message}`)
        } else {
            setProducts(products.filter(p => p.id !== productId))
            alert(`Product ${status} successfully.`)
        }
    }

    if (loading) return <div className="p-8">Loading pending assets...</div>

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter italic">Pending Approvals</h1>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Protocol: Quality Control & Asset Verification</p>
            </div>

            {products.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
                    <p className="text-slate-400 font-black uppercase tracking-widest">No pending assets in queue</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="bg-white p-6 rounded-[32px] border border-slate-100 flex gap-8 items-center">
                            <div className="w-24 h-32 relative rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0">
                                <Image src={product.image_url} alt={product.title} fill className="object-cover" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-black uppercase tracking-tight text-lg">{product.title}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller: @{product.profiles?.username}</p>
                                    </div>
                                    <p className="text-xl font-black">₹{product.price.toLocaleString()}</p>
                                </div>
                                <p className="text-sm text-slate-600 line-clamp-2 mb-6">{product.description}</p>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => handleStatusUpdate(product.id, 'approved')}
                                        className="bg-green-500 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 transition-all shadow-lg shadow-green-100"
                                    >
                                        Approve Asset
                                    </button>
                                    <button 
                                        onClick={() => handleStatusUpdate(product.id, 'rejected')}
                                        className="bg-red-50 text-red-500 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-100 transition-all"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
