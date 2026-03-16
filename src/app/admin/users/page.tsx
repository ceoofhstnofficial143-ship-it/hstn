"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                email,
                role,
                is_banned,
                created_at
            `)
            .order("created_at", { ascending: false })

        if (data) setUsers(data)
        setLoading(false)
    }

    const toggleBan = async (id: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${!currentStatus ? 'BAN' : 'RESTORE'} this user?`)) return
        
        const { error } = await supabase
            .from("profiles")
            .update({ is_banned: !currentStatus })
            .eq("id", id)

        if (error) {
            alert(`Protocol failure: ${error.message}`)
        } else {
            fetchUsers()
        }
    }

    const toggleAdmin = async (id: string, currentRole: string) => {
        const nextRole = currentRole === 'admin' ? 'user' : 'admin'
        if (!confirm(`Switch user role to ${nextRole.toUpperCase()}?`)) return

        const { error } = await supabase
            .from("profiles")
            .update({ role: nextRole })
            .eq("id", id)

        if (error) {
            alert(`Role switch failed: ${error.message}`)
        } else {
            fetchUsers()
        }
    }

    if (loading) return <div className="animate-pulse space-y-8">
        <div className="h-10 w-48 bg-slate-100 rounded-xl"></div>
        <div className="h-96 bg-white rounded-[40px] border border-slate-100 shadow-sm"></div>
    </div>

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-4xl font-black tracking-tight">User <span className="text-slate-400">Governance</span></h1>
                <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Entity management and access control protocols</p>
            </header>

            <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Access Tier</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Moderation</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs">
                                            {u.username?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-tight">@{u.username || 'Ghost Entity'}</p>
                                            <p className="text-[10px] text-slate-400 font-bold font-mono">{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                        u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                                    }`}>
                                        {u.role || 'user'}
                                    </span>
                                </td>
                                <td className="px-8 py-6">
                                    {u.is_banned ? (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-1 rounded">Locked</span>
                                    ) : (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-50 px-2 py-1 rounded">Verified</span>
                                    )}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button 
                                            onClick={() => toggleAdmin(u.id, u.role)}
                                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                                        >
                                            {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                        </button>
                                        <button 
                                            onClick={() => toggleBan(u.id, u.is_banned)}
                                            className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${
                                                u.is_banned 
                                                ? 'bg-black text-white border-black' 
                                                : 'text-red-500 border-red-100 hover:bg-red-500 hover:text-white hover:border-red-500'
                                            }`}
                                        >
                                            {u.is_banned ? 'Restore Access' : 'Terminate Account'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
