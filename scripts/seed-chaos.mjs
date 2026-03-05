import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rand(0, arr.length - 1)]

const CATEGORIES = ["Co-ord sets", "Trendy tops", "Casual dresses", "Korean-style fashion", "Other Luxury"]
const FIT_TYPES = ["true_to_size", "relaxed", "slim", "oversized", "cropped", "stretch"]

async function ensureTrustScores(userIds) {
  for (const userId of userIds) {
    await supabase.from("trust_scores").upsert({
      user_id: userId,
      score: rand(0, 180),
      verified: false,
    })
  }
}

async function main() {
  const sellers = Array.from({ length: 10 }, () => crypto.randomUUID())
  const buyers = Array.from({ length: 20 }, () => crypto.randomUUID())

  await ensureTrustScores(sellers)

  const products = []
  for (let i = 0; i < 120; i++) {
    const sellerId = pick(sellers)
    products.push({
      title: `Chaos Drop #${i + 1}`,
      sku: `CHAOS-${String(i + 1).padStart(4, "0")}`,
      price: rand(299, 2499),
      description: "Synthetic product seeded for load testing.",
      image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop",
      video_url: i % 3 === 0 ? "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4" : null,
      user_id: sellerId,
      stock: rand(0, 25),
      category: pick(CATEGORIES),
      color_verified: true,
      measurements: { bust: "88", waist: "72", hips: "96", length: "100", sleeve: "56" },
      model_info: { height: "165", weight: "55", size: "S" },
      fit_type: pick(FIT_TYPES),
      size_verified: true,
      admin_status: "approved",
    })
  }

  const { data: insertedProducts, error: pErr } = await supabase.from("products").insert(products).select("id,user_id,price")
  if (pErr) throw pErr

  const orders = []
  for (let i = 0; i < 80; i++) {
    const p = pick(insertedProducts)
    orders.push({
      product_id: p.id,
      seller_id: p.user_id,
      buyer_id: pick(buyers),
      status: pick(["processing", "shipped", "delivered"]),
      full_name: `Buyer ${i + 1}`,
      phone: `9${rand(100000000, 999999999)}`,
      address: "Test Address",
      city: "Test City",
      pincode: `${rand(100000, 999999)}`,
      fit_feedback: null,
      dispute_status: null,
      dispute_reason: null,
    })
  }

  const { error: oErr } = await supabase.from("orders").insert(orders)
  if (oErr) throw oErr

  console.log("Seed complete:", {
    sellers: sellers.length,
    buyers: buyers.length,
    products: insertedProducts.length,
    orders: orders.length,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

