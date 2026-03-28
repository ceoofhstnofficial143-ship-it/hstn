"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function TestUploadPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")

    useEffect(() => {
        const getSession = async () => {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
                setUser(data.session.user)
            } else {
                router.push("/login")
            }
        }
        getSession()
    }, [router])

    const handleSimpleUpload = async () => {
        if (!user) return

        setLoading(true)
        setMessage("")

        try {
            console.log('Starting simple test upload...')

            // Create product with minimal data to avoid conflicts
            const { data, error } = await (supabase as any)
                .from("products")
                .insert({
                    title: `Test Product ${Date.now()}`,
                    sku: `TEST-${Date.now()}`,
                    price: 999,
                    description: "Test upload for debugging",
                    category: "Co-ord sets",
                    user_id: user.id,
                    stock: 1,
                    color_verified: true,
                    size_verified: true,
                    measurements: { bust: 90, waist: 70, hips: 80, length: 85, sleeve: 60 },
                    model_info: { height: 165, weight: 60, size: "M" },
                    fit_type: "true_to_size",
                    admin_status: "pending"
                })
                .select()

            if (error) {
                console.error('Insert error:', error)
                setMessage(`Error: ${error.message}`)
            } else {
                console.log('Insert success:', data)
                setMessage(`Success! Product ID: ${data[0]?.id}`)
            }
        } catch (err) {
            console.error('Upload error:', err)
            const message = err instanceof Error ? err.message : String(err)
            setMessage(`Error: ${message}`)
        } finally {
            setLoading(false)
        }
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Please Login</h1>
                    <p className="text-muted">You need to be logged in to test uploads.</p>
                    <button 
                        onClick={() => router.push("/login")}
                        className="luxury-button px-8 py-3"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="section-container py-16">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-h1 font-bold mb-8">Test Upload Page</h1>
                <p className="text-body text-muted mb-8">
                    This page tests the upload functionality without conflicts.
                    Use this to isolate the "redact from market" error.
                </p>

                <div className="bg-accent/10 rounded-xl p-6 mb-8">
                    <h2 className="text-lg font-bold mb-4">Simple Test Upload</h2>
                    
                    <button
                        onClick={handleSimpleUpload}
                        disabled={loading}
                        className="luxury-button w-full"
                    >
                        {loading ? "Uploading..." : "Test Simple Upload"}
                    </button>

                    {message && (
                        <div className="mt-4 p-4 bg-white/80 rounded-lg">
                            <p className="text-sm font-mono">{message}</p>
                        </div>
                    )}
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 text-red-700">Debug Instructions</h2>
                    <ol className="list-decimal space-y-2 text-sm">
                        <li>Open browser console (F12)</li>
                        <li>Click "Test Simple Upload"</li>
                        <li>Watch for any automatic DELETE requests</li>
                        <li>Check for conflict errors</li>
                        <li>Monitor Supabase operations</li>
                    </ol>
                </div>

                <div className="mt-8 text-center">
                    <button 
                        onClick={() => router.push("/upload")}
                        className="luxury-button px-6 py-2"
                    >
                        Back to Upload Page
                    </button>
                </div>
            </div>
        </div>
    )
}
