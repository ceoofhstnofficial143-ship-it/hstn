"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface SimplePurchaseRequest {
    id: string
    product_id: string
    buyer_id: string
    status: 'pending' | 'contacted' | 'completed' | 'cancelled'
    buyer_message: string
    seller_notes: string
    created_at: string
    updated_at: string
    buyer_name: string
    product_title: string
    product_price: number
}

export default function SimpleSellerRequests({ sellerId }: { sellerId: string }) {
    const [requests, setRequests] = useState<SimplePurchaseRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [marketplaceStage, setMarketplaceStage] = useState<any>(null)

    useEffect(() => {
        fetchRequests()
        fetchMarketplaceStage()
    }, [sellerId, filter])

    const fetchRequests = async () => {
        setLoading(true)
        
        // Use RPC function for proper data fetching
        const { data, error } = await supabase.rpc("get_seller_purchase_requests", {
            p_seller_id: sellerId,
            p_status: filter === 'all' ? null : filter,
            p_limit: 50,
            p_offset: 0
        })

        if (error) {
            console.error('Error fetching requests:', error)
        } else {
            setRequests(data || [])
        }
        
        setLoading(false)
    }

    const fetchMarketplaceStage = async () => {
        const { data } = await supabase.rpc('get_marketplace_stage')
        setMarketplaceStage(data?.[0] || null)
    }

    const updateRequestStatus = async (requestId: string, newStatus: string, notes?: string) => {
        // Use SAFE function (no trust impact)
        const { error } = await supabase.rpc('update_simple_request_status_safe', {
            p_request_id: requestId,
            p_new_status: newStatus,
            p_seller_notes: notes
        })

        if (error) {
            console.error('Error updating request:', error)
            alert("Failed to update request status")
        } else {
            // Refresh requests
            fetchRequests()
            
            // Updated success messages (no trust impact mentioned)
            const statusMessages = {
                contacted: "Buyer notified you'll contact them",
                completed: "Order marked as complete (awaiting buyer confirmation)",
                cancelled: "Request cancelled"
            }
            alert(statusMessages[newStatus as keyof typeof statusMessages])
        }
    }

    const getStatusColor = (status: string) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            contacted: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        }
        return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
    }

    const getStatusIcon = (status: string) => {
        const icons = {
            pending: '⏳',
            contacted: '💬',
            completed: '✅',
            cancelled: '❌'
        }
        return icons[status as keyof typeof icons] || '📋'
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white/50 rounded-xl p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <div className="space-y-2">
                            <div className="h-3 bg-gray-200 rounded"></div>
                            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Simple Header */}
            <div className="flex justify-between items-center">
                <h3 className="text-h3 font-bold">Purchase Requests</h3>
                
                <div className="flex gap-2">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                        <option value="all">All ({requests.length})</option>
                        <option value="pending">Pending ({requests.filter(r => r.status === 'pending').length})</option>
                        <option value="contacted">Contacted ({requests.filter(r => r.status === 'contacted').length})</option>
                        <option value="completed">Completed ({requests.filter(r => r.status === 'completed').length})</option>
                    </select>
                </div>
            </div>

            {/* Stage Zero Notice */}
            {marketplaceStage && !marketplaceStage.enable_advanced_protection && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">🚀</span>
                        <div>
                            <h4 className="font-bold text-green-900 mb-1">Simple Mode - Focus on Growth</h4>
                            <p className="text-sm text-green-800">Advanced protection will activate when marketplace reaches 25 sellers and 100+ requests.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Simple Requests List */}
            {requests.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <div className="text-4xl mb-4">📭</div>
                    <h4 className="text-lg font-bold text-gray-700 mb-2">No requests yet</h4>
                    <p className="text-sm text-gray-600">When buyers request your products, they'll appear here</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((request) => (
                        <div key={request.id} className="bg-white/50 rounded-xl p-6 border border-gray-200">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(request.status)}`}>
                                            {getStatusIcon(request.status)} {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            ID: {request.id.slice(0, 8)}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-lg">{request.product_title}</h4>
                                    <p className="text-sm text-gray-600">From: {request.buyer_name}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-primary">₹{request.product_price.toLocaleString()}</div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(request.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            {/* Buyer Message */}
                            {request.buyer_message && (
                                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                    <h5 className="text-sm font-bold text-gray-700 mb-1">Message:</h5>
                                    <p className="text-sm text-gray-600">{request.buyer_message}</p>
                                </div>
                            )}

                            {/* Simple Action Buttons */}
                            <div className="flex gap-2">
                                {request.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => updateRequestStatus(request.id, 'contacted')}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            Mark Contacted
                                        </button>
                                        <button
                                            onClick={() => {
                                                const notes = prompt('Add notes (optional):')
                                                if (notes) {
                                                    updateRequestStatus(request.id, 'contacted', notes)
                                                }
                                            }}
                                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
                                        >
                                            Add Notes
                                        </button>
                                    </>
                                )}
                                
                                {request.status === 'contacted' && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Mark this order as completed?')) {
                                                updateRequestStatus(request.id, 'completed')
                                            }
                                        }}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                    >
                                        Mark Complete
                                    </button>
                                )}
                                
                                {request.status === 'pending' && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Cancel this request?')) {
                                                updateRequestStatus(request.id, 'cancelled')
                                            }
                                        }}
                                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>

                            {/* Seller Notes */}
                            {request.seller_notes && (
                                <div className="bg-blue-50 rounded-lg p-3 mt-4">
                                    <h5 className="text-sm font-bold text-blue-700 mb-1">Your Notes:</h5>
                                    <p className="text-sm text-blue-600">{request.seller_notes}</p>
                                </div>
                            )}

                            {/* Simple Next Steps */}
                            {request.status === 'contacted' && (
                                <div className="bg-yellow-50 rounded-lg p-3 mt-4">
                                    <h5 className="text-sm font-bold text-yellow-700 mb-1">Next Step:</h5>
                                    <p className="text-sm text-yellow-600">
                                        Contact buyer to arrange payment and delivery. Mark complete when finished.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
