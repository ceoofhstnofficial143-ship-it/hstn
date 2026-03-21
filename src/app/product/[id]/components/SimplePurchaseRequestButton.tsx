"use client"

import Link from "next/link"

interface SimplePurchaseRequestButtonProps {
    product: {
        id: string
        title: string
    }
    className?: string
}

export default function SimplePurchaseRequestButton({ product, className = "" }: SimplePurchaseRequestButtonProps) {
    return (
        <Link 
            href={`/product/${product.id}`}
            className={`block w-full h-11 min-h-[44px] bg-black text-white font-semibold rounded-lg transition-colors hover:bg-gray-800 active:scale-95 text-center leading-11 ${className}`}
        >
            View Product
        </Link>
    )
}
