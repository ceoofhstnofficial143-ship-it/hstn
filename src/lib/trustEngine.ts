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

export async function updateTrustScore(userId: string, event: keyof typeof TRUST_EVENTS) {
  // Security: trust writes are handled server-side (DB triggers / privileged routines).
  // This client helper is kept for callsites but performs no direct DB mutation.
  if (!userId) return
  console.warn("[Trust Engine] Ignored client trust update:", { userId, event })
}
