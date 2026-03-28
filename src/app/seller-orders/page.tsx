"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

// Prevent prerendering - page uses client-side auth
export const dynamic = 'force-dynamic'

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user?.user) return

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          products ( title, image_url ),
          profiles!orders_buyer_id_fkey ( username )
        `)
        .eq("seller_id", user.user.id)

      if (!error && data) {
        setOrders(data)
      }
    }

    fetchOrders()
  }, [])

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId)

    if (error) {
      alert("Failed to update status")
    } else {
      alert("Status updated")
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Incoming Orders</h1>

      {orders.length === 0 && <p>No incoming orders yet.</p>}

      {orders.map((order) => (
        <div key={order.id} className="border p-4 mb-4 rounded">
          <img
            src={order.products.image_url}
            className="w-24 h-24 object-cover mb-2"
          />
          <h2 className="font-semibold">{order.products.title}</h2>
          <p>Ordered On: {new Date(order.created_at).toLocaleDateString()}</p>
          <p>Buyer: {order.profiles.username}</p>
          <p>Status: {order.status}</p>
          <select
            value={order.status}
            onChange={(e) => updateStatus(order.id, e.target.value)}
            className="border p-2 mt-2"
          >
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      ))}
    </div>
  )
}