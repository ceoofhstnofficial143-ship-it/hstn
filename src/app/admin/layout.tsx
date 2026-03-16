"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const router = useRouter()

    useEffect(() => {
        checkAdmin()
    }, [])

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single()

        if (profile?.role === "admin") {
            setIsAdmin(true)
        } else {
            router.push("/")
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Verifying Admin Credentials</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-slate-900">
            {/* Admin Sidebar/Topnav */}
            <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-12">
                        <Link href="/admin" className="flex items-center gap-2">
                             <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                                 <span className="text-white text-xs font-black">H</span>
                             </div>
                             <span className="font-black text-xl tracking-tighter uppercase italic">
                                ADM <span className="text-slate-400 not-italic font-medium">Panel</span>
                             </span>
                        </Link>
                        
                        <div className="hidden lg:flex items-center gap-8">
                            <Link href="/admin" className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Dashboard</Link>
                            <Link href="/admin/products" className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Inventory Review</Link>
                            <Link href="/admin/users" className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">User Governance</Link>
                            <Link href="/admin/orders" className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Order Logs</Link>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">
                           Exit to Marketplace →
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {children}
            </div>
        </div>
    )
}
