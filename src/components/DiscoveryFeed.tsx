"use client"

import { useRef } from "react"
import ProductCard from "./ProductCard"

interface Product {
  id: string
  title: string
  price: number
  video_url?: string
  image_url?: string
  category?: string
  trust?: { score: number; verified: boolean }
  profiles: { username: string }
  user_id: string
  seller_id: string
  description?: string
}

export default function DiscoveryFeed({ products }: { products: any[] }) {
  const containerRef = useRef(null)

  return (
    <div
      ref={containerRef}
      className="h-[80vh] overflow-y-scroll snap-y snap-mandatory rounded-3xl"
    >
      {products.map((product) => (
        <div
          key={product.id}
          className="h-[80vh] snap-start flex items-center justify-center"
        >
          <ProductCard product={product} fullScreen />
        </div>
      ))}
    </div>
  )
}
