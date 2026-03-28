"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        fullName: "",
        phone: "",
        bio: ""
    })
    const router = useRouter()

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }
            setUser(user)

            // Fetch existing profile data
            const { data: profile } = await (supabase as any)
                .from("profiles")
                .select("full_name, phone, bio")
                .eq("id", user.id)
                .single()

            if (profile) {
                setFormData({
                    fullName: profile.full_name || "",
                    phone: profile.phone || "",
                    bio: profile.bio || ""
                })
            }

            setLoading(false)
        }
        fetchUser()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        const { error } = await (supabase as any)
            .from("profiles")
            .upsert({
                id: user.id,
                full_name: formData.fullName,
                phone: formData.phone,
                bio: formData.bio,
                updated_at: new Date().toISOString()
            })

        if (error) {
            alert(`Update failed: ${error.message}`)
        } else {
            alert("Profile updated successfully!")
            router.push("/profile")
        }

        setSaving(false)
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
                <header className="mb-16">
                    <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-black mb-8 transition-colors">
                        ← Back to Profile
                    </Link>
                    <span className="text-caption uppercase tracking-widest text-primary font-bold">Account Settings</span>
                    <h1 className="text-display mt-2 text-black">Edit Your Profile</h1>
                    <p className="text-body text-gray-700 mt-4">Update your personal information and preferences.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
                        <div className="luxury-card p-8 bg-white border-gray-100 shadow-sm">
                            <h2 className="text-h3 font-bold mb-6 text-black">Personal Information</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-6 py-4 text-black focus:ring-1 ring-primary transition-all outline-none"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-6 py-4 text-black focus:ring-1 ring-primary transition-all outline-none"
                                        placeholder="Enter your phone number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Bio</label>
                                    <textarea
                                        value={formData.bio}
                                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-6 py-4 text-black focus:ring-1 ring-primary transition-all outline-none"
                                        placeholder="Tell us about yourself"
                                        rows={4}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="luxury-button flex-1 py-5 !text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-gray-900"
                            >
                                {saving ? "Synchronizing..." : "Save Changes"}
                            </button>
                            <Link href="/profile" className="flex-1">
                                <button
                                    type="button"
                                    className="w-full h-full border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </Link>
                        </div>
                    </form>

                    <aside className="space-y-6">
                        <div className="luxury-card p-8 bg-primary/5 border-primary/20 space-y-6">
                            <div>
                                <h3 className="text-caption font-bold text-primary uppercase tracking-widest mb-2">Shipping Protocol</h3>
                                <p className="text-[10px] leading-relaxed text-gray-600 uppercase tracking-widest">
                                    Shipping destinations are now managed through our high-performance Address Protocol.
                                </p>
                            </div>
                            
                            <Link href="/profile/addresses" className="block p-5 bg-white rounded-2xl border border-gray-100 hover:border-primary transition-all group shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">Manage Addresses</p>
                                        <p className="text-[9px] text-gray-400 uppercase font-medium">Add or edit destinations</p>
                                    </div>
                                    <span className="text-xl">📍</span>
                                </div>
                            </Link>
                        </div>

                        <div className="p-8 border border-gray-100 rounded-[32px] space-y-4 bg-gray-50/50">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Security Protocol</h3>
                            <p className="text-[9px] text-gray-500 leading-relaxed uppercase font-medium">
                                All profile modifications are logged in our decentralized session ledger to ensure account integrity.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}
