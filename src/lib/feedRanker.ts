import { getViralScore } from "./viralScore"

export function rankProducts(products: any[]) {
  return products.sort((a, b) => getScore(b) - getScore(a))
}

function getScore(product: any) {
  const trust = product.trust?.score ?? 0
  const viral = getViralScore(product)
  const hasVideo = product.video_url ? 8 : 0
  const isBoosted = product.is_boosted ? 25 : 0
  
  // Recency bonus: last 24h
  const isNew = (Date.now() - new Date(product.created_at).getTime()) < (24 * 60 * 60 * 1000)
  const newBonus = isNew ? 15 : 0

  return (trust * 1.5) + (viral * 3) + hasVideo + isBoosted + newBonus
}
