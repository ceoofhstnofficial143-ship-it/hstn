"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface SimplePurchaseRequestButtonProps {
    product: {
        id: string
        title: string
        price: number
        seller_id: string
        user: {
            username: string
        }
    }
    user: any
    className?: string
}

export default function SimplePurchaseRequestButton({ product, user, className = "" }: SimplePurchaseRequestButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState("")

    const handleRequestPurchase = async () => {
        if (!user) {
            // Redirect to login
            window.location.href = "/login"
            return
        }

        setIsLoading(true)
        
        try {
            // Use simple function (no fraud detection)
            const { data, error } = await supabase.rpc('create_simple_purchase_request', {
                p_product_id: product.id,
                p_buyer_id: user.id,
                p_buyer_message: message || null
            })

            if (error) {
                console.error('Error creating purchase request:', error)
                alert("Failed to submit request. Please try again.")
                return
            }

            // Show simple success modal
            const successModal = document.createElement('div')
            successModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6'
            successModal.innerHTML = `
                <div class="bg-white rounded-2xl p-8 max-w-md w-full text-center">
                    <div class="text-6xl mb-4">🎯</div>
                    <h3 class="text-2xl font-bold mb-2">Request Sent!</h3>
                    <p class="text-gray-600 mb-6">${product.user.username} will contact you soon.</p>
                    <div class="bg-gray-50 rounded-xl p-4 mb-6">
                        <div class="text-sm text-gray-700">
                            <div class="font-semibold mb-2">Order Details:</div>
                            <div>• ${product.title}</div>
                            <div>• ₹${product.price.toLocaleString()}</div>
                            <div>• Request ID: ${data?.slice(0, 8) || 'Processing'}</div>
                        </div>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors">
                        Got it!
                    </button>
                </div>
            `
            document.body.appendChild(successModal)

            // Auto-remove after 3 seconds (shorter - less intimidating)
            setTimeout(() => {
                if (successModal.parentNode) {
                    successModal.parentNode.removeChild(successModal)
                }
            }, 3000)

        } catch (error) {
            console.error('Error:', error)
            alert("Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    if (!user) {
        return (
            <button 
                onClick={() => window.location.href = "/login"}
                className={`luxury-button ${className}`}
            >
                Login to Request
            </button>
        )
    }

    return (
        <div className="space-y-3">
            <button
                onClick={handleRequestPurchase}
                disabled={isLoading}
                className={`w-full h-11 min-h-[44px] bg-black text-white font-semibold rounded-lg transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 active:scale-95'}`}
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                    </span>
                ) : (
                    "Request Purchase"
                )}
            </button>

            {/* Simple message field optimized for mobile */}
            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional message to seller..."
                className="w-full p-4 border border-gray-200 rounded-lg resize-none min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                maxLength={200}
                rows={2}
            />
        </div>
    )
}
