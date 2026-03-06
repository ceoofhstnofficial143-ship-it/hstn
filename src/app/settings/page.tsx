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
        address: "",
        city: "",
        pincode: "",
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
            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single()

            if (profile) {
                setFormData({
                    fullName: profile.full_name || "",
                    phone: profile.phone || "",
                    address: profile.address || "",
                    city: profile.city || "",
                    pincode: profile.pincode || "",
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

        const { error } = await supabase
            .from("profiles")
            .upsert({
                id: user.id,
                full_name: formData.fullName,
                phone: formData.phone,
                address: formData.address,
                city: formData.city,
                pincode: formData.pincode,
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
                    <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-8">
                        ← Back to Profile
                    </Link>
                    <span className="text-caption uppercase tracking-widest text-primary font-bold">Account Settings</span>
                    <h1 className="text-display mt-2">Edit Your Profile</h1>
                    <p className="text-body text-muted mt-4">Update your personal information and preferences.</p>
                </header>

                <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
                    <div className="luxury-card p-8">
                        <h2 className="text-h3 font-bold mb-6">Personal Information</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter your full name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter your phone number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Bio</label>
                                <textarea
                                    value={formData.bio}
                                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Tell us about yourself"
                                    rows={4}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="luxury-card p-8">
                        <h2 className="text-h3 font-bold mb-6">Shipping Address</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Address</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter your address"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">City</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="City"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Pincode</label>
                                    <input
                                        type="text"
                                        value={formData.pincode}
                                        onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Pincode"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="luxury-button flex-1"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <Link href="/profile" className="flex-1">
                            <button
                                type="button"
                                className="w-full border border-gray-300 text-gray-700 font-semibold rounded-lg py-4 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    )
}
