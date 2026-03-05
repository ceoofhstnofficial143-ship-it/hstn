export type TrustTier = {
  name: "Probation" | "Verified" | "Gold" | "Elite"
  minScore: number
  badgeClass: string
  icon: string
  label: string
}

export function getTrustTier(score: number | null | undefined): TrustTier {
  const s = typeof score === "number" ? score : 0

  if (s >= 150) {
    return { name: "Elite", minScore: 150, badgeClass: "bg-blue-500/15 text-blue-700 border-blue-500/25", icon: "🔵", label: "Elite Seller" }
  }
  if (s >= 100) {
    return { name: "Gold", minScore: 100, badgeClass: "bg-yellow-500/15 text-yellow-700 border-yellow-500/25", icon: "🟡", label: "Gold Seller" }
  }
  if (s >= 50) {
    return { name: "Verified", minScore: 50, badgeClass: "bg-green-500/15 text-green-700 border-green-500/25", icon: "🟢", label: "Verified Seller" }
  }
  return { name: "Probation", minScore: 0, badgeClass: "bg-red-500/10 text-red-600 border-red-500/20", icon: "⚪", label: "New Seller" }
}

export function getTrustBoost(score: number | null | undefined): number {
  const s = typeof score === "number" ? score : 0
  if (s >= 150) return 40
  if (s >= 100) return 25
  if (s >= 50) return 10
  return 0
}

export function getRecencyBoost(createdAt: string | Date | null | undefined): number {
  if (!createdAt) return 0
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt
  const days = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)

  if (days < 3) return 15
  if (days < 7) return 8
  if (days < 14) return 3
  return 0
}


