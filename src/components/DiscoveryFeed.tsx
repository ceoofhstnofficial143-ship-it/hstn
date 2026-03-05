"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { getTrustTier } from "@/lib/trustTier"

interface Product {
    id: string
    title: string
    price: number
    video_url: string
    image_url: string
    category: string
    trust?: { score: number; verified: boolean }
}

export default function DiscoveryFeed({ products }: { products: Product[] }) {
    const feedRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    // Filter products that have videos for the discovery feed
    const videoProducts = products.filter(p => p.video_url).slice(0, 5)

    const socialProofs = [
        "Someone in Mumbai just bagged this! 🔥",
        "3 girls in Bangalore added this to cart 🛒",
        "Verified Purchase in Delhi 🛡️",
        "Flash Sale: 5 pieces left in Jaipur ⚡",
        "Trending in South Delhi right now ✨"
    ]

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.getAttribute("data-index") || "0")
                        setActiveIndex(index)
                    }
                })
            },
            { threshold: 0.7 }
        )

        const items = feedRef.current?.querySelectorAll(".feed-item")
        items?.forEach((item) => observer.observe(item))

        return () => observer.disconnect()
    }, [videoProducts])

    if (videoProducts.length === 0) return null

    return (
        <section className="relative h-[85vh] w-full bg-black overflow-hidden rounded-[40px] shadow-2xl group">
            <div
                ref={feedRef}
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide no-scrollbar"
            >
                {videoProducts.map((product, index) => {
                    const tier = getTrustTier(product.trust?.score)
                    return (
                        <div
                            key={product.id}
                            data-index={index}
                            className="feed-item relative h-full w-full snap-start flex flex-col justify-end"
                        >
                            {/* Immersive Video Layer */}
                            <video
                                src={product.video_url}
                                className="absolute inset-0 w-full h-full object-cover opacity-80"
                                autoPlay
                                loop
                                muted
                                playsInline
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

                            {/* Social Proof Overlay (Dopamine) */}
                            <div className="absolute top-12 left-8 animate-fade-in pointer-events-none">
                                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-full shadow-lg transition-smooth hover:scale-105">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                    </span>
                                    <span className="text-[10px] text-white font-bold uppercase tracking-widest leading-none">
                                        {socialProofs[index % socialProofs.length]}
                                    </span>
                                </div>
                            </div>

                            {/* Discovery UI (Sidebar actions) */}
                            <div className="absolute right-6 bottom-32 flex flex-col gap-8 items-center z-20">
                                <div className="flex flex-col items-center gap-2 group/action cursor-pointer">
                                    <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-smooth group-hover/action:scale-110 group-hover/action:bg-primary/20">
                                        <span className="text-2xl">🤍</span>
                                    </div>
                                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">Wish</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 group/action cursor-pointer">
                                    <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-smooth group-hover/action:scale-110 group-hover/action:bg-primary/20">
                                        <span className="text-2xl">🔗</span>
                                    </div>
                                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">Share</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-xl">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${product.id}`}
                                            className="w-full h-full object-cover"
                                            alt="Seller"
                                        />
                                    </div>
                                    <div className={`flex items-center justify-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full -mt-3 uppercase backdrop-blur-md border border-white/20 shadow-lg ${tier.name === 'Probation' ? 'bg-white/10 text-white' : 'bg-primary text-black'}`}>
                                        <span>{tier.icon}</span>
                                        <span>{tier.name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Content Info (Reels Style) */}
                            <div className="relative p-10 space-y-4 max-w-xl z-20">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[9px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
                                        <span className="text-xs">{tier.icon}</span> {tier.label}
                                    </span>
                                    {(product.trust?.verified || product.video_url) && (
                                        <span className="px-3 py-1 bg-primary/90 text-black text-[9px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-pulse-slow">
                                            <span className="text-xs">🛡️</span> Trusted Fabric Seller
                                        </span>
                                    )}
                                    <span className="px-3 py-1 bg-black/40 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest rounded-full border border-white/10">High Velocity SKU</span>
                                </div>
                                <h3 className="text-display text-white italic drop-shadow-2xl">{product.title}</h3>
                                <p className="text-body text-white/70 line-clamp-1 leading-relaxed">{product.category} • Professional Grade Capture</p>

                                <div className="flex items-center gap-8 pt-4">
                                    <div className="flex flex-col">
                                        <span className="text-primary text-h2 font-bold drop-shadow-xl">₹{product.price}</span>
                                        <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1">Free Delivery Today</span>
                                    </div>
                                    <Link
                                        href={`/products/${product.id}`}
                                        className="luxury-button !bg-white !text-black !py-4 !px-10 !text-[11px] shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-pulse"
                                    >
                                        Grab It Now 🛍️
                                    </Link>
                                </div>
                            </div>

                            {/* Progress Indicators */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                {videoProducts.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1 rounded-full transition-smooth ${i === activeIndex ? 'w-12 bg-primary' : 'w-4 bg-white/20'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Instruction Overlay */}
            <div className="absolute left-1/2 bottom-8 -translate-x-1/2 text-[10px] text-white/30 uppercase tracking-[0.4em] font-bold pointer-events-none animate-bounce">
                Swipe up for more outfits
            </div>
        </section>
    )
}
