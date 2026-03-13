import { getViralScore } from "./viralScore"

export function rankProducts(products: any[]) {
  return products.sort((a, b) => getScore(b) - getScore(a))
}

function getScore(product: any) {
  const trust = product.trust?.score ?? 0
  const viral = getViralScore(product)
  const hasVideo = product.video_url ? 5 : 0

  return trust * 2 + viral * 3 + hasVideo
}
