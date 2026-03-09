import { supabase } from "./supabase"

export const TRUST_EVENTS = {
  DELIVERY_SUCCESS: { delta: 5, description: "Successful confirmed delivery" },
  CANCELLATION: { delta: -15, description: "Cancellation after confirmation" },
  WRONG_PRODUCT: { delta: -25, description: "Wrong product complaint confirmed" },
  LATE_SHIPMENT: { delta: -10, description: "Late shipment" },
  POOR_VIDEO: { delta: -5, description: "Poor video quality rejection" },
  ACCURATE_SIZE: { delta: 2, description: "Accurate size feedback" },
  SIZE_ANOMALY: { delta: -3, description: "Size anomaly detected across buyers" },
} as const

// Enhanced trust scoring factors
export const TRUST_FACTORS = {
  // Sales performance (40%)
  SALES_SUCCESS_RATE: { weight: 0.4, description: "Successful delivery rate" },
  SALES_VOLUME: { weight: 0.15, description: "Number of successful sales" },

  // Verification quality (30%)
  PHOTO_QUALITY: { weight: 0.15, description: "Photo quality and consistency" },
  VIDEO_VERIFICATION: { weight: 0.15, description: "Video verification completeness" },

  // Customer feedback (20%)
  CUSTOMER_RATINGS: { weight: 0.15, description: "Average customer ratings" },
  REVIEW_COUNT: { weight: 0.05, description: "Number of reviews received" },

  // Account standing (10%)
  ACCOUNT_AGE: { weight: 0.08, description: "Time since account creation" },
  PROFILE_COMPLETENESS: { weight: 0.02, description: "Profile completion percentage" },
} as const

export interface TrustScoreComponents {
  salesScore: number
  verificationScore: number
  feedbackScore: number
  accountScore: number
  totalScore: number
  tier: 'Probation' | 'Verified' | 'Gold' | 'Elite'
}

// Calculate comprehensive trust score
export function calculateTrustScore(productData: any, sellerData: any, reviewData: any[]): TrustScoreComponents {
  // Sales performance score (0-100)
  const salesScore = calculateSalesScore(sellerData)

  // Verification quality score (0-100)
  const verificationScore = calculateVerificationScore(productData)

  // Customer feedback score (0-100)
  const feedbackScore = calculateFeedbackScore(reviewData)

  // Account standing score (0-100)
  const accountScore = calculateAccountScore(sellerData)

  // Weighted total score
  const totalScore = Math.round(
    salesScore * TRUST_FACTORS.SALES_SUCCESS_RATE.weight +
    verificationScore * (TRUST_FACTORS.PHOTO_QUALITY.weight + TRUST_FACTORS.VIDEO_VERIFICATION.weight) +
    feedbackScore * (TRUST_FACTORS.CUSTOMER_RATINGS.weight + TRUST_FACTORS.REVIEW_COUNT.weight) +
    accountScore * (TRUST_FACTORS.ACCOUNT_AGE.weight + TRUST_FACTORS.PROFILE_COMPLETENESS.weight)
  )

  // Determine tier
  const tier = totalScore >= 150 ? 'Elite' :
               totalScore >= 100 ? 'Gold' :
               totalScore >= 50 ? 'Verified' : 'Probation'

  return {
    salesScore,
    verificationScore,
    feedbackScore,
    accountScore,
    totalScore,
    tier
  }
}

function calculateSalesScore(sellerData: any): number {
  if (!sellerData) return 0

  const totalSales = sellerData.total_sales || 0
  const successfulDeliveries = sellerData.successful_deliveries || 0
  const successRate = totalSales > 0 ? (successfulDeliveries / totalSales) * 100 : 0

  // Base score from success rate
  let score = successRate

  // Bonus for volume
  if (totalSales >= 50) score += 20
  else if (totalSales >= 20) score += 10
  else if (totalSales >= 5) score += 5

  return Math.min(100, Math.max(0, score))
}

function calculateVerificationScore(productData: any): number {
  if (!productData) return 0

  let score = 0

  // Photo quality (has 6 photos + additional images)
  const hasMainImage = productData.image_url ? 1 : 0
  const additionalImages = productData.additional_images?.length || 0
  const totalPhotos = hasMainImage + additionalImages

  if (totalPhotos >= 6) score += 50  // Full 6-photo set
  else if (totalPhotos >= 4) score += 30
  else if (totalPhotos >= 2) score += 15
  else if (totalPhotos >= 1) score += 5

  // Video verification
  if (productData.video_url) score += 50  // Has verification video

  return Math.min(100, score)
}

function calculateFeedbackScore(reviews: any[]): number {
  if (!reviews || reviews.length === 0) return 50  // Neutral score for no reviews

  const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
  const reviewCount = reviews.length

  // Rating score (0-80 points)
  const ratingScore = (avgRating / 5) * 80

  // Volume bonus (0-20 points)
  let volumeBonus = 0
  if (reviewCount >= 20) volumeBonus = 20
  else if (reviewCount >= 10) volumeBonus = 15
  else if (reviewCount >= 5) volumeBonus = 10
  else if (reviewCount >= 2) volumeBonus = 5

  return Math.min(100, ratingScore + volumeBonus)
}

function calculateAccountScore(sellerData: any): number {
  if (!sellerData) return 0

  let score = 0

  // Account age (created_at exists)
  if (sellerData.created_at) {
    const accountAge = (Date.now() - new Date(sellerData.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30) // months
    if (accountAge >= 12) score += 50  // 1+ year
    else if (accountAge >= 6) score += 35  // 6+ months
    else if (accountAge >= 3) score += 20  // 3+ months
    else if (accountAge >= 1) score += 10  // 1+ month
    else score += 5  // New account
  }

  // Profile completeness
  const profileFields = ['username', 'email', 'phone', 'location']
  const completedFields = profileFields.filter(field => sellerData[field]).length
  const completenessScore = (completedFields / profileFields.length) * 50
  score += completenessScore

  return Math.min(100, score)
}

export async function updateTrustScore(userId: string, event: keyof typeof TRUST_EVENTS) {
  // Security: trust writes are handled server-side (DB triggers / privileged routines).
  // This client helper is kept for callsites but performs no direct DB mutation.
  if (!userId) return
  console.warn("[Trust Engine] Ignored client trust update:", { userId, event })
}
