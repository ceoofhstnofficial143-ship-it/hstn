"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface BuyerConfirmationProps {
    request: {
        id: string
        status: string
        seller_id: string
        product_title: string
        product_price: number
        seller_name: string
    }
    user: any
    onConfirmed: () => void
}

export default function BuyerConfirmation({ request, user, onConfirmed }: BuyerConfirmationProps) {
    const [isConfirming, setIsConfirming] = useState(false)

    const handleConfirmCompletion = async () => {
        if (!user) return
        
        setIsConfirming(true)
        
        try {
            const { error } = await supabase.rpc('confirm_request_completion_with_trust', {
                p_request_id: request.id,
                p_buyer_id: user.id
            })

            if (error) {
                console.error('Error confirming completion:', error)
                alert("Failed to confirm completion")
            } else {
                // Show success modal
                const successModal = document.createElement('div')
                successModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6'
                successModal.innerHTML = `
                    <div class="bg-white rounded-2xl p-8 max-w-md w-full text-center">
                        <div class="text-6xl mb-4">✅</div>
                        <h3 class="text-2xl font-bold mb-2">Order Confirmed!</h3>
                        <p class="text-gray-600 mb-6">Thank you for confirming. ${request.seller_name}'s trust score has been updated.</p>
                        <div class="bg-green-50 rounded-xl p-4 mb-6">
                            <div class="text-sm text-green-700">
                                <div class="font-semibold mb-2">Order Summary:</div>
                                <div>• ${request.product_title}</div>
                                <div>• ₹${request.product_price.toLocaleString()}</div>
                                <div>• Seller: ${request.seller_name}</div>
                            </div>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">
                            Complete
                        </button>
                    </div>
                `
                document.body.appendChild(successModal)

                // Auto-remove after 4 seconds
                setTimeout(() => {
                    if (successModal.parentNode) {
                        successModal.parentNode.removeChild(successModal)
                    }
                }, 4000)

                onConfirmed() // Refresh parent component
            }
        } catch (error) {
            console.error('Error:', error)
            alert("Something went wrong. Please try again.")
        } finally {
            setIsConfirming(false)
        }
    }

    // Only show if seller marked complete but buyer hasn't confirmed
    if (request.status !== 'completed' || !user) {
        return null
    }

    return (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                    <h4 className="font-bold text-orange-900 mb-2">Confirm Order Completion</h4>
                    <p className="text-sm text-orange-800 mb-4">
                        {request.seller_name} marked this order as complete. Please confirm if you've received your order and are satisfied.
                    </p>
                    <div className="bg-white rounded-lg p-3 mb-4">
                        <div className="text-sm">
                            <div className="font-semibold">Order Details:</div>
                            <div>• {request.product_title}</div>
                            <div>• ₹{request.product_price.toLocaleString()}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleConfirmCompletion}
                        disabled={isConfirming}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isConfirming ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Confirming...
                            </span>
                        ) : (
                            "Confirm Order Received"
                        )}
                    </button>
                    <p className="text-xs text-orange-600 mt-3 text-center">
                        This confirmation updates the seller's trust score
                    </p>
                </div>
            </div>
        </div>
    )
}
