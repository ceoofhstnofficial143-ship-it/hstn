"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getTrustBoost, getRecencyBoost } from "@/lib/trustTier"
import ProductCard from "@/components/ProductCard"
import DiscoveryFeed from "@/components/DiscoveryFeed"

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        profiles:user_id(username)
      `)
      .eq("admin_status", "approved")
      .order("created_at", { ascending: false })

    if (error) return

    const productsWithTrust = await Promise.all(
      (data ?? []).map(async (product) => {
        const { data: trust } = await supabase
          .from("trust_scores")
          .select("score, verified")
          .eq("user_id", product.user_id)
          .single()

        return { ...product, trust }
      })
    )

    const ranked = productsWithTrust.sort((a, b) => {
      const aVerified = a.video_url ? 1 : 0
      const bVerified = b.video_url ? 1 : 0
      if (aVerified !== bVerified) return bVerified - aVerified

      const aBoost = getTrustBoost(a.trust?.score)
      const bBoost = getTrustBoost(b.trust?.score)
      if (aBoost !== bBoost) return bBoost - aBoost

      const aRec = getRecencyBoost(a.created_at)
      const bRec = getRecencyBoost(b.created_at)
      if (aRec !== bRec) return bRec - aRec

      const aScore = a.trust?.score ?? 0
      const bScore = b.trust?.score ?? 0
      if (aScore !== bScore) return bScore - aScore

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setProducts(ranked)
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // Derived sections
  const trending = products.slice(0, 5)
  const topRated = products.slice(0, 4)

  const highVelocityCategories = [
    { name: "Co-ord sets", range: "₹699–₹1299", img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1920&auto=format&fit=crop" },
    { name: "Trendy tops", range: "₹399–₹799", img: "https://images.unsplash.com/photo-1551163943-3f6a855d1153?q=80&w=1887&auto=format&fit=crop" },
    { name: "Casual dresses", range: "₹799–₹1499", img: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1983&auto=format&fit=crop" },
    { name: "Korean-style fashion", range: "Viral Picks", img: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1887&auto=format&fit=crop" },
    { name: "New Arrivals", range: "Just Launched", img: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=2012&auto=format&fit=crop" }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="bg-background animate-fade-in">
      {/* HERO SECTION: LEANING INTO TRUST */}
      <section className="relative h-[80vh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
            alt="Luxury Transparency"
            className="w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="relative h-full section-container flex flex-col justify-center items-center text-center px-6 transition-all duration-1000 animate-fade-in delay-200">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/20 backdrop-blur-md rounded-full border border-white/10 mb-10 overflow-hidden group">
            <span className="w-2 h-2 bg-primary animate-pulse rounded-full" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-white font-bold">Verified Fabric Transparency</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-light-sweep" />
          </div>

          <h1 className="text-3xl md:text-5xl text-white mb-10 max-w-5xl tracking-tight leading-[0.9] animate-fade-in relative group cursor-default">
            Finally, <br />
            <span className="text-primary italic font-light relative inline-block">
              Shop With Sight.
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-light-sweep" />
            </span>
          </h1>

          <p className="text-caption uppercase tracking-[0.5em] text-white/90 mb-12 font-bold max-w-2xl mx-auto leading-relaxed border-b border-white/10 pb-8">
            Fabric Transparency for Every Trend.
          </p>

          <div className="flex gap-6 animate-fade-in delay-500">
            <Link href="/products" className="luxury-button !py-6 !px-16 text-[12px] tracking-[0.2em]">
              Enter the Gallery
            </Link>
          </div>
        </div>
      </section>

      <div className="section-container space-y-32 py-32">
        {/* REELS STYLE DISCOVERY FEED */}
        <section>
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-caption uppercase tracking-widest text-primary font-bold">Discovery Mode</span>
              <h2 className="text-h1 mt-2">Dopamine Feed 📺</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-accent overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="" />
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest">+1.2k viewing now</span>
            </div>
          </div>
          <DiscoveryFeed products={products} />
        </section>

        {/* STRATEGIC CATEGORIES (SWIPEABLE GRID) */}
        <section>
          <div className="text-center mb-16 px-4">
            <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold px-6 py-2 bg-primary/5 rounded-full border border-primary/10">The Strategic Boutique</span>
            <h2 className="text-h1 mt-8">Pick Your Vibe</h2>
          </div>
          <div className="flex lg:grid lg:grid-cols-5 gap-8 overflow-x-auto lg:overflow-visible pb-8 scrollbar-hide no-scrollbar px-4 snap-x">
            {highVelocityCategories.map((cat) => (
              <Link
                key={cat.name}
                href={`/products?category=${cat.name}`}
                className="group relative min-w-[280px] lg:min-w-0 aspect-[4/5] rounded-[32px] overflow-hidden hover-lift transition-smooth snap-start"
              >
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover transition-smooth group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-smooth" />
                <div className="absolute bottom-8 left-8 right-8">
                  <span className="text-white text-caption font-bold uppercase tracking-[0.2em] block mb-2">{cat.name}</span>
                  <div className="flex justify-between items-center">
                    <span className="text-primary text-[10px] font-bold uppercase tracking-widest">{cat.range}</span>
                    <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-smooth">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* TRUST MOAT BANNER (THE HSTN EDGE) */}
        <section className="bg-foreground text-card py-16 sm:py-24 rounded-none sm:rounded-[40px] px-6 sm:px-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -mr-48 -mt-48 blur-3xl" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <span className="text-caption uppercase tracking-[0.3em] text-primary font-bold">The HSTN Shield</span>
              <h2 className="text-h1 text-white mt-6 mb-8">Your Moat Against <br /> Low-Quality Marketplace.</h2>
              <p className="text-body text-white/60 leading-relaxed mb-12">
                We've built a trust stack that ensures high-velocity sales with zero fear. Every piece in our gallery is verified through a rigorous transparency protocol.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {[
                  { title: "Fabric Transparency", desc: "Mandatory video showing weave & drape." },
                  { title: "Try-On Previews", desc: "See the fit in real-world environments." },
                  { title: "Seller Trust Index", desc: "Scores based on history & video quality." },
                  { title: "Escrow Protection", desc: "Payments held until delivery confirmation." }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <h4 className="text-primary text-caption font-bold uppercase tracking-widest flex items-center gap-3">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-white/40 leading-relaxed uppercase tracking-tight">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="luxury-card aspect-[4/3] bg-white/5 border-white/10 backdrop-blur-xl p-4 flex items-center justify-center relative">
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-black to-gray-900 overflow-hidden flex items-center justify-center">
                <div className="text-center text-white/60">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">Fabric Verification</p>
                  <p className="text-xs text-white/40">Coming Soon</p>
                </div>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                <span className="text-6xl mb-6">🛡️</span>
                <h3 className="text-h2 text-white">Verified Verification</h3>
                <p className="text-caption text-primary font-bold uppercase tracking-widest mt-4">Standard on all HSTN SKUs</p>
              </div>
            </div>
          </div>
        </section>

        {/* TRENDING NOW (Horizontal Scroll) */}
        <section>
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-caption uppercase tracking-widest text-primary font-bold">Viral Now</span>
              <h2 className="text-h1 mt-2">The HSTN Edit</h2>
            </div>
            <Link href="/products" className="text-caption font-bold uppercase tracking-widest border-b-2 border-primary pb-1">
              View All Arrivals
            </Link>
          </div>

          <div className="flex overflow-x-auto gap-8 pb-12 snap-x scrollbar-hide no-scrollbar">
            {trending.length > 0 ? trending.map((product) => (
              <div key={product.id} className="min-w-[320px] md:min-w-[400px] snap-start">
                <ProductCard product={product} />
              </div>
            )) : (
              <div className="w-full py-20 bg-accent/10 rounded-[40px] text-center border-dashed border-2 border-border">
                <p className="text-caption uppercase font-bold tracking-widest text-muted">Awaiting the next viral drop</p>
              </div>
            )}
          </div>
        </section>

        {/* TOP RATED SELECTION */}
        <section>
          <div className="text-center mb-16">
            <span className="text-caption uppercase tracking-widest text-primary font-bold">Elite Verified Sellers</span>
            <h2 className="text-h1 mt-2">The Trust Index Selection</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {topRated.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-border py-12 text-center text-caption uppercase tracking-widest text-muted">
        © 2026 HSTN Trust Network. Building the future of Transparent Commerce.
      </footer>
    </main>
  )
}