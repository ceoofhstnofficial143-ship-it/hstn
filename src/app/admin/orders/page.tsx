"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"

export default function AdminOrders() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("orders")
            .select(`
                id,
                total_price,
                status,
                created_at,
                user_id,
                seller_id,
                profiles:user_id(username, email),
                product:product_id(title, image_url)
            `)
            .order("created_at", { ascending: false })

        if (data) setOrders(data)
        setLoading(false)
    }

    const updateStatus = async (id: string, newStatus: string) => {
        const { error } = await supabase
            .from("orders")
            .update({ status: newStatus })
            .eq("id", id)

        if (error) {
            alert(`Protocol failure: ${error.message}`)
        } else {
            fetchOrders()
        }
    }

    if (loading) return <div className="animate-pulse space-y-8">
        <div className="h-10 w-48 bg-slate-100 rounded-xl"></div>
        <div className="h-96 bg-white rounded-[40px] border border-slate-100 shadow-sm"></div>
    </div>

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-4xl font-black tracking-tight">Order <span className="text-slate-400">Intelligence</span></h1>
                <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Global transaction logs and fulfillment monitoring</p>
            </header>

            <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Assets</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Acquirer</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">State</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valuation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                    <p className="text-[10px] font-black font-mono text-slate-400 mb-1">ID: #{order.id.slice(0,8).toUpperCase()}</p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden relative border border-slate-100">
                                            {order.product?.image_url ? (
                                                <Image src={order.product.image_url} alt="" fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-slate-200" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-tight line-clamp-1 max-w-[150px]">{order.product?.title || 'Unknown Piece'}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Asset Requisition</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black text-[10px]">
                                            {order.profiles?.username?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black">@{order.profiles?.username || 'Unknown'}</p>
                                            <p className="text-[9px] text-slate-400 font-bold ">{order.profiles?.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <select 
                                        value={order.status} 
                                        onChange={(e) => updateStatus(order.id, e.target.value)}
                                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all cursor-pointer outline-none ${
                                            order.status === 'delivered' ? 'bg-green-50 text-green-600 border-green-100' :
                                            order.status === 'shipped' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                            order.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                            'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="shipped">Shipped</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <p className="text-sm font-black text-slate-900 tracking-tight">₹ {order.total_price?.toLocaleString() || '0'}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Gross Val</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
