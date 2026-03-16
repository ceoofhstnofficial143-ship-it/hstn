"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface PurchaseRequest {
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

export default function SellerPurchaseRequests({ sellerId }: { sellerId: string }) {
    const [requests, setRequests] = useState<PurchaseRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)

    useEffect(() => {
        fetchRequests()
        fetchPerformanceMetrics()
    }, [sellerId, filter])

    const fetchRequests = async () => {
        setLoading(true)
        
        const { data, error } = await supabase.rpc('get_seller_purchase_requests', {
            p_seller_id: sellerId,
            p_status: filter === 'all' ? null : filter,
            p_limit: 50
        })

        if (error) {
            console.error('Error fetching requests:', error)
        } else {
            setRequests(data || [])
        }
        
        setLoading(false)
    }

    const fetchPerformanceMetrics = async () => {
        const { data, error } = await supabase.rpc('get_seller_performance_metrics', {
            p_seller_id: sellerId
        })

        if (error) {
            console.error('Error fetching metrics:', error)
        } else {
            setPerformanceMetrics(data?.[0] || null)
        }
    }

    const updateRequestStatus = async (requestId: string, newStatus: string, notes?: string) => {
        const { error } = await supabase.rpc('update_protected_request_status', {
            p_request_id: requestId,
            p_new_status: newStatus,
            p_seller_notes: notes,
            p_buyer_confirmation: false // Only seller can update
        })

        if (error) {
            console.error('Error updating request:', error)
            alert("Failed to update request status")
        } else {
            // Refresh requests and metrics
            fetchRequests()
            fetchPerformanceMetrics()
            
            // Show success message
            const statusMessages = {
                contacted: "Buyer will be notified you've contacted them",
                completed: "Order marked as completed - Waiting for buyer confirmation",
                cancelled: "Request has been cancelled"
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
            {/* Performance Metrics Dashboard */}
            {performanceMetrics && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                    <h4 className="text-lg font-bold text-purple-900 mb-4">📊 Your Performance Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-black text-purple-700">
                                {performanceMetrics.response_rate}%
                            </div>
                            <div className="text-xs uppercase tracking-widest text-purple-600 font-bold mt-1">
                                Response Rate
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-blue-700">
                                {performanceMetrics.avg_response_time_hours}h
                            </div>
                            <div className="text-xs uppercase tracking-widest text-blue-600 font-bold mt-1">
                                Avg Response Time
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-green-700">
                                {performanceMetrics.completion_rate}%
                            </div>
                            <div className="text-xs uppercase tracking-widest text-green-600 font-bold mt-1">
                                Completion Rate
                            </div>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-black ${
                                performanceMetrics.performance_grade === 'A' ? 'text-green-600' :
                                performanceMetrics.performance_grade === 'B' ? 'text-blue-600' :
                                performanceMetrics.performance_grade === 'C' ? 'text-yellow-600' :
                                performanceMetrics.performance_grade === 'D' ? 'text-orange-600' :
                                'text-red-600'
                            }`}>
                                {performanceMetrics.performance_grade}
                            </div>
                            <div className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">
                                Performance Grade
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 text-center">
                        <div className="text-sm text-purple-700">
                            Requests this week: <span className="font-bold">{performanceMetrics.requests_last_7_days}</span>
                        </div>
                        {performanceMetrics.performance_grade === 'A' && (
                            <div className="text-xs text-green-600 mt-2">
                                🏆 Excellent performance! Buyers trust your reliability.
                            </div>
                        )}
                        {performanceMetrics.performance_grade === 'F' && (
                            <div className="text-xs text-red-600 mt-2">
                                ⚠️ Performance needs improvement to maintain buyer trust.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
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

            {/* Beta Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">🚧</span>
                    <div>
                        <h4 className="font-bold text-blue-900 mb-1">Beta Phase - Direct Fulfillment</h4>
                        <p className="text-sm text-blue-800">Contact buyers directly to arrange payment and delivery. Mark as completed when order is fulfilled.</p>
                    </div>
                </div>
            </div>

            {/* Requests List */}
            {requests.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <div className="text-4xl mb-4">📭</div>
                    <h4 className="text-lg font-bold text-gray-700 mb-2">No purchase requests yet</h4>
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
                                            Request ID: {request.id.slice(0, 8)}
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
                                    <h5 className="text-sm font-bold text-gray-700 mb-1">Buyer Message:</h5>
                                    <p className="text-sm text-gray-600">{request.buyer_message}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                {request.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => updateRequestStatus(request.id, 'contacted')}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            Mark as Contacted
                                        </button>
                                        <button
                                            onClick={() => {
                                                const notes = prompt('Add notes for this request:')
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
                                            if (confirm('Mark this order as completed? This will update your trust score.')) {
                                                updateRequestStatus(request.id, 'completed')
                                            }
                                        }}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                    >
                                        Mark as Completed
                                    </button>
                                )}
                                
                                {request.status === 'pending' && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Cancel this purchase request?')) {
                                                updateRequestStatus(request.id, 'cancelled')
                                            }
                                        }}
                                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
                                    >
                                        Cancel Request
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

                            {/* Contact Info */}
                            {request.status === 'contacted' && (
                                <div className="bg-yellow-50 rounded-lg p-3 mt-4">
                                    <h5 className="text-sm font-bold text-yellow-700 mb-1">Next Steps:</h5>
                                    <p className="text-sm text-yellow-600">
                                        Contact the buyer directly to arrange payment and delivery. Mark as completed when fulfilled.
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
