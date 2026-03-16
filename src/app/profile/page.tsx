"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }
            setUser(user)

            // Fetch profile data
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single()
            
            setProfile(profileData)
            setLoading(false)
        }
        fetchUserData()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/")
    }

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
                <header className="mb-16 flex justify-between items-end">
                    <div>
                        <span className="text-caption uppercase tracking-widest text-primary font-bold">Member Dashboard</span>
                        <h1 className="text-display mt-2 italic">Welcome, {profile?.full_name || user?.email?.split('@')[0] || "Collector"}</h1>
                        <p className="text-body text-muted mt-4">Manage your acquisitions and account settings.</p>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="text-[10px] uppercase tracking-[0.3em] font-black text-red-500 hover:text-red-700 transition-smooth border-b border-red-500/20 pb-1"
                    >
                        Terminate Session
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Quick Stats/Links */}
                    <Link href="/orders" className="luxury-card p-10 bg-accent/20 border-none group hover-lift">
                        <div className="text-3xl mb-4">📦</div>
                        <h3 className="text-h3 font-bold mb-2 uppercase tracking-tight italic">Acquisitions</h3>
                        <p className="text-caption">Track your luxury acquisitions and delivery status.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold group-hover:translate-x-2 transition-smooth">View All →</div>
                    </Link>

                    <Link href="/wishlist" className="luxury-card p-10 bg-accent/20 border-none group hover-lift">
                        <div className="text-3xl mb-4">♡</div>
                        <h3 className="text-h3 font-bold mb-2 uppercase tracking-tight italic">The Vault</h3>
                        <p className="text-caption">Curate items you're watching for your future collection.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold group-hover:translate-x-2 transition-smooth">View Items →</div>
                    </Link>

                    <div className="luxury-card p-10 bg-accent/20 border-none group hover-lift cursor-pointer" onClick={() => router.push("/settings")}>
                        <div className="text-3xl mb-4">⚙️</div>
                        <h3 className="text-h3 font-bold mb-2 uppercase tracking-tight italic">Settings</h3>
                        <p className="text-caption">Update your profile, shipping addresses, and security.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold group-hover:translate-x-2 transition-smooth">Configure →</div>
                    </div>

                    <div className="luxury-card p-10 bg-foreground text-card border-none group hover-lift cursor-pointer">
                        <div className="text-3xl mb-4 text-primary">⚜️</div>
                        <h3 className="text-h3 font-bold mb-2 uppercase tracking-tight italic">Heritage Tier</h3>
                        <p className="text-caption text-white/60">Titanium Membership Active. Insured shipping enabled.</p>
                        <div className="mt-8 text-[10px] uppercase tracking-widest text-primary font-bold">Protocol Benefits</div>
                    </div>
                </div>

                {/* Account Details */}
                <section className="mt-24">
                    <h2 className="text-h3 font-black uppercase tracking-[0.3em] mb-12 border-b border-border pb-6 italic">Identity Management</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="luxury-card p-8 flex items-center justify-between bg-accent/5">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Authenticated Name</p>
                                    <p className="text-body font-black uppercase tracking-tight">{profile?.full_name || "N/A"}</p>
                                </div>
                                <button className="text-[10px] uppercase tracking-widest font-bold text-primary">Modify</button>
                            </div>
                            <div className="luxury-card p-8 flex items-center justify-between bg-accent/5">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Digital Address</p>
                                    <p className="text-body font-black">{user?.email}</p>
                                </div>
                                <div className="text-[9px] uppercase tracking-widest font-black text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">Primary Link</div>
                            </div>
                        </div>

                        <div className="bg-primary/10 rounded-[40px] p-12 flex flex-col items-center text-center backdrop-blur-sm border border-primary/20">
                            <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center text-primary text-display mb-6 border-4 border-primary/20 shadow-2xl">
                                {profile?.full_name?.[0].toUpperCase() || user?.email?.[0].toUpperCase()}
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 italic">Elite Collector</p>
                            <p className="text-[11px] font-bold text-muted mb-8 leading-relaxed uppercase tracking-widest">Authorized for high-value asset acquisitions and vault management.</p>
                            <button className="luxury-button !py-3 !px-10 !text-[9px] uppercase tracking-[0.3em] font-black">Digital Passport</button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}

