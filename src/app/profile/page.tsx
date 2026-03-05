"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }
        fetchUser()
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <main className="bg-background min-h-screen animate-fade-in py-20">
            <div className="section-container">
                <header className="mb-16">
                    <span className="text-caption uppercase tracking-widest text-primary font-bold">Member Dashboard</span>
                    <h1 className="text-display mt-2">Welcome, {user?.email?.split('@')[0] || "Collector"}</h1>
                    <p className="text-body text-muted mt-4">Manage your acquisitions and account settings.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Quick Stats/Links */}
                    <Link href="/orders" className="luxury-card p-10 bg-accent/20 border-none group hover-lift">
                        <div className="text-3xl mb-4">📦</div>
                        <h3 className="text-h3 font-bold mb-2">My Orders</h3>
                        <p className="text-caption">Track your luxury acquisitions and delivery status.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold group-hover:translate-x-2 transition-smooth">View All →</div>
                    </Link>

                    <Link href="/wishlist" className="luxury-card p-10 bg-accent/20 border-none group hover-lift">
                        <div className="text-3xl mb-4">♡</div>
                        <h3 className="text-h3 font-bold mb-2">Wishlist</h3>
                        <p className="text-caption">Curate items you're watching for your future collection.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold group-hover:translate-x-2 transition-smooth">View Items →</div>
                    </Link>

                    <div className="luxury-card p-10 bg-accent/20 border-none group hover-lift cursor-pointer">
                        <div className="text-3xl mb-4">⚙️</div>
                        <h3 className="text-h3 font-bold mb-2">Settings</h3>
                        <p className="text-caption">Update your profile, shipping addresses, and security.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold group-hover:translate-x-2 transition-smooth">Configure →</div>
                    </div>

                    <div className="luxury-card p-10 bg-foreground text-card border-none group hover-lift cursor-pointer">
                        <div className="text-3xl mb-4 text-primary">⚜️</div>
                        <h3 className="text-h3 font-bold mb-2">Heritage Program</h3>
                        <p className="text-caption text-white/60">You are a Titanium Member. Free insured shipping active.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold">Tiers & Benefits</div>
                    </div>
                </div>

                {/* Recent Activity Section */}
                <section className="mt-24">
                    <h2 className="text-h2 mb-12 border-b border-border pb-6">Account Overview</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="luxury-card p-8 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Security Standard</p>
                                    <p className="text-body font-bold text-green-600">Level 4 Certified • HSTN Encrypted</p>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                            <div className="luxury-card p-8 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Email Address</p>
                                    <p className="text-body font-bold">{user?.email}</p>
                                </div>
                                <button className="text-[10px] uppercase tracking-widest font-bold text-primary">Edit</button>
                            </div>
                        </div>

                        <div className="bg-primary/10 rounded-[40px] p-12 flex flex-col items-center text-center">
                            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-display mb-6">
                                {user?.email?.[0].toUpperCase()}
                            </div>
                            <p className="text-body font-bold mb-2">Verified Collector</p>
                            <p className="text-caption mb-8 leading-relaxed">Your identity has been verified. You can now pre-order high-value items.</p>
                            <button className="luxury-button !py-3 !px-10 !text-[10px]">Verify Extra Documents</button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
