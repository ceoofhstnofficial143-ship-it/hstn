"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Analytics } from "@/lib/analytics"

interface PurchaseRequestButtonProps {
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

export default function PurchaseRequestButton({ product, user, className = "" }: PurchaseRequestButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [showMessage, setShowMessage] = useState(false)
    const [message, setMessage] = useState("")

    const handleRequestPurchase = async () => {
        if (!user) {
            // Redirect to login
            window.location.href = "/login"
            return
        }

        setIsLoading(true)
        
        try {
            // Create purchase request
            const { data, error } = await supabase.rpc('create_purchase_request', {
                p_product_id: product.id,
                p_buyer_id: user.id,
                p_buyer_message: message || null
            })

            if (error) {
                console.error('Error creating purchase request:', error)
                alert("Failed to submit request. Please try again.")
                return
            }

            // Log analytics
            await Analytics.logAddToCart(user.id, product.id, product.seller_id)
            await Analytics.logCheckoutStart(user.id)

            // Show success modal
            setShowMessage(false)
            setMessage("")
            
            // Show success dialog
            const successModal = document.createElement('div')
            successModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6'
            successModal.innerHTML = `
                <div class="bg-white rounded-2xl p-8 max-w-md w-full">
                    <div class="text-center">
                        <div class="text-4xl mb-4">🎯</div>
                        <h3 class="text-xl font-bold mb-2">Purchase Request Submitted!</h3>
                        <p class="text-gray-600 mb-6">${product.user.username} will contact you shortly to complete your order.</p>
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
                </div>
            `
            document.body.appendChild(successModal)

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (successModal.parentNode) {
                    successModal.parentNode.removeChild(successModal)
                }
            }, 5000)

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
        <div className="space-y-4">
            <button 
                onClick={handleRequestPurchase}
                disabled={isLoading}
                className={`luxury-button w-full ${className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                    </span>
                ) : (
                    "Request Purchase"
                )}
            </button>
            
            {/* Optional message field */}
            <div className="space-y-2">
                <button 
                    onClick={() => setShowMessage(!showMessage)}
                    className="text-sm text-gray-600 hover:text-primary transition-colors"
                >
                    {showMessage ? "Hide" : "Add"} message for seller
                </button>
                
                {showMessage && (
                    <div className="space-y-2">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Optional: Tell the seller about size preferences, delivery timeline, or any questions..."
                            className="w-full p-3 border border-gray-200 rounded-xl resize-none h-20 text-sm"
                            maxLength={500}
                        />
                        <div className="text-xs text-gray-500 text-right">
                            {message.length}/500
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
