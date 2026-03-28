import { supabase } from './supabase'

// Google Analytics event tracking
export const trackGAEvent = (eventName: string, params: Record<string, any> = {}) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', eventName, params)
    }
}

// Universal Event Tracking - Core Monitoring Engine
export const trackEvent = async (eventType: string, metadata: Record<string, any> = {}) => {
    // Always log in development for debugging
    if (typeof window !== 'undefined') {
        console.log('📊 EVENT:', eventType, metadata)
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await (supabase as any).from('marketplace_events').insert({
            event_type: eventType,
            user_id: user?.id || null,
            metadata: metadata,
            created_at: new Date().toISOString()
        })
        
        if (error) {
            console.error('❌ Tracking DB error:', error)
        }
    } catch (err) {
        console.error('❌ Tracking failed:', err)
    }
}

// Event logging utility for Marketplace Intelligence Layer
export class Analytics {
    static async logProductView(userId: string, productId: string, sellerId: string) {
        try {
            await (supabase as any).rpc('log_product_view', {
                p_user_id: userId,
                p_product_id: productId,
                p_seller_id: sellerId
            })
        } catch (error) {
            console.error('Failed to log product view:', error)
        }
    }

    static async logVideoPlay(userId: string, productId: string, sellerId: string) {
        try {
            await (supabase as any).rpc('log_video_play', {
                p_user_id: userId,
                p_product_id: productId,
                p_seller_id: sellerId
            })
        } catch (error) {
            console.error('Failed to log video play:', error)
        }
    }

    static async logWishlistAdd(userId: string, productId: string, sellerId: string) {
        try {
            await (supabase as any).rpc('log_wishlist_add', {
                p_user_id: userId,
                p_product_id: productId,
                p_seller_id: sellerId
            })
        } catch (error) {
            console.error('Failed to log wishlist add:', error)
        }
    }

    static async logAddToCart(userId: string, productId: string, sellerId: string) {
        try {
            await (supabase as any).rpc('log_add_to_cart', {
                p_user_id: userId,
                p_product_id: productId,
                p_seller_id: sellerId
            })
        } catch (error) {
            console.error('Failed to log add to cart:', error)
        }
    }

    static async logCheckoutStart(userId: string) {
        try {
            await (supabase as any).rpc('log_checkout_start', {
                p_user_id: userId
            })
        } catch (error) {
            console.error('Failed to log checkout start:', error)
        }
    }

    static async logCheckoutComplete(userId: string, orderId: string) {
        try {
            await (supabase as any).rpc('log_checkout_complete', {
                p_user_id: userId,
                p_order_id: orderId
            })
        } catch (error) {
            console.error('Failed to log checkout complete:', error)
        }
    }

    static async logUploadCreated(sellerId: string, productId: string) {
        try {
            await (supabase as any).rpc('log_upload_created', {
                p_seller_id: sellerId,
                p_product_id: productId
            })
        } catch (error) {
            console.error('Failed to log upload created:', error)
        }
    }

    static async logUploadApproved(sellerId: string, productId: string) {
        try {
            await (supabase as any).rpc('log_upload_approved', {
                p_seller_id: sellerId,
                p_product_id: productId
            })
        } catch (error) {
            console.error('Failed to log upload approved:', error)
        }
    }

    static async logQuestCompleted(sellerId: string, questType: string) {
        try {
            await (supabase as any).rpc('log_quest_completed', {
                p_seller_id: sellerId,
                p_quest_type: questType
            })
        } catch (error) {
            console.error('Failed to log quest completed:', error)
        }
    }

    static async logFeedView(userId: string) {
        try {
            await (supabase as any).rpc('log_marketplace_event', {
                p_event_type: 'feed_view',
                p_user_id: userId
            })
        } catch (error) {
            console.error('Failed to log feed view:', error)
        }
    }

    // Refresh analytics data
    static async refreshAnalytics() {
        try {
            await (supabase as any).rpc('refresh_all_analytics')
        } catch (error) {
            console.error('Failed to refresh analytics:', error)
        }
    }

    // Get product heat score
    static async getProductHeatScore(productId: string): Promise<number> {
        try {
            const { data } = await (supabase as any).rpc('calculate_product_heat_score', {
                p_product_id: productId
            })
            return data || 0
        } catch (error) {
            console.error('Failed to get product heat score:', error)
            return 0
        }
    }
}
