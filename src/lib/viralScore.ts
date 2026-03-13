export function getViralScore(product: any) {
  const likes = product.likes ?? 0
  const views = product.views ?? 0

  const hours =
    (Date.now() - new Date(product.created_at).getTime()) / 3600000

  const safeHours = Math.max(hours, 1)

  const engagement = likes * 4 + views * 0.2

  return engagement / safeHours
}
